import { execFile } from 'child_process';

import type { CiStatus, PrInfo, ReviewStatus, YourPrStatus } from '../types.js';

const BOT_LOGINS = new Set(['coderabbitai', 'github-actions', 'dependabot']);

const REVIEW_DETAILS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviews(last: 20) {
        nodes {
          author { login }
          state
          submittedAt
        }
      }
      reviewThreads(last: 100) {
        nodes {
          isResolved
          comments(first: 10) {
            nodes {
              author { login }
            }
          }
        }
      }
      commits(last: 1) {
        nodes {
          commit {
            committedDate
            statusCheckRollup {
              state
            }
          }
        }
      }
      reviewRequests(last: 10) {
        nodes {
          requestedReviewer {
            ... on User { login }
          }
        }
      }
    }
  }
}`;

export class GitHubService {
  private readonly repo: string;
  private readonly user: string;
  private readonly owner: string;
  private readonly repoName: string;
  private readonly baseBranch: string;
  private yourPrsCache: { data: PrInfo[]; lastUpdated: string } | null = null;
  private toReviewCache: { data: PrInfo[]; lastUpdated: string } | null = null;

  constructor(config?: { github?: { repo?: string; user?: string; baseBranch?: string } }) {
    this.repo = config?.github?.repo ?? process.env.GH_REPO ?? 'kubev2v/forklift-console-plugin';
    this.user = config?.github?.user ?? process.env.GH_USER ?? 'avivtur';
    this.baseBranch = config?.github?.baseBranch ?? 'main';
    [this.owner, this.repoName] = this.repo.split('/');
  }

  getYourPrsCached(): PrInfo[] {
    return this.yourPrsCache?.data ?? [];
  }

  getPrsToReviewCached(): PrInfo[] {
    return this.toReviewCache?.data ?? [];
  }

  getYourPrsLastUpdated(): string | null {
    return this.yourPrsCache?.lastUpdated ?? null;
  }

  getPrsToReviewLastUpdated(): string | null {
    return this.toReviewCache?.lastUpdated ?? null;
  }

  async fetchYourPrs(): Promise<PrInfo[]> {
    const raw = await this.execGh([
      'pr', 'list', '--repo', this.repo, '--state', 'open', '--author', this.user,
      '--json', 'number,title,createdAt,url,reviewDecision,mergeable,headRefName',
    ]);

    const prs = JSON.parse(raw) as GhPrResult[];
    const enriched: PrInfo[] = await Promise.all(
      prs.map(async (pr) => {
        const [classification, behindBy] = await Promise.all([
          this.classifyYourPrStatus(pr.number),
          this.fetchBehindBy(pr.headRefName, this.user),
        ]);
        return {
          number: pr.number,
          title: pr.title,
          createdAt: pr.createdAt,
          url: pr.url,
          reviewDecision: pr.reviewDecision ?? 'PENDING',
          mergeable: pr.mergeable,
          behindBy,
          ciStatus: classification.ciStatus,
          yourPrStatus: classification.status,
          humanReviewCount: classification.humanReviewCount,
          botCommentCount: classification.botCommentCount,
          unresolvedHumanThreads: classification.unresolvedHumanThreads,
          repliedHumanThreads: classification.repliedHumanThreads,
        };
      }),
    );

    this.yourPrsCache = { data: enriched, lastUpdated: new Date().toISOString() };
    return enriched;
  }

  private async classifyYourPrStatus(prNumber: number): Promise<{
    status: YourPrStatus;
    ciStatus?: CiStatus;
    humanReviewCount: number;
    botCommentCount: number;
    unresolvedHumanThreads: number;
    repliedHumanThreads: number;
  }> {
    const zeroCounts = { humanReviewCount: 0, botCommentCount: 0, unresolvedHumanThreads: 0, repliedHumanThreads: 0 };
    try {
      const raw = await this.execGh([
        'api', 'graphql',
        '-f', `query=${REVIEW_DETAILS_QUERY}`,
        '-f', `owner=${this.owner}`,
        '-f', `repo=${this.repoName}`,
        '-F', `number=${prNumber}`,
      ]);

      const data = JSON.parse(raw) as GraphQLResponse;
      const pr = data.data?.repository?.pullRequest;
      if (!pr) return { status: 'awaiting-review', ...zeroCounts };

      const ciState = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state as CiStatus | undefined;

      const allReviews = pr.reviews?.nodes ?? [];
      const humanReviews = allReviews.filter(
        (r) => !BOT_LOGINS.has(r.author?.login?.toLowerCase() ?? ''),
      );

      const allThreads = pr.reviewThreads?.nodes ?? [];
      const botThreads = allThreads.filter((t) => {
        const firstAuthor = t.comments?.nodes?.[0]?.author?.login?.toLowerCase() ?? '';
        return BOT_LOGINS.has(firstAuthor);
      });
      const unresolvedHuman = allThreads.filter((t) => {
        if (t.isResolved) return false;
        const firstAuthor = t.comments?.nodes?.[0]?.author?.login?.toLowerCase() ?? '';
        return !BOT_LOGINS.has(firstAuthor);
      });

      const uniqueHumanReviewers = new Set(
        humanReviews.map((r) => r.author?.login?.toLowerCase()).filter(Boolean),
      );
      const repliedHumanThreads = unresolvedHuman.filter((t) => {
        const comments = t.comments?.nodes ?? [];
        if (comments.length < 2) return false;
        const lastComment = comments[comments.length - 1];
        return lastComment.author?.login === this.user;
      });

      const counts = {
        humanReviewCount: uniqueHumanReviewers.size,
        botCommentCount: botThreads.length,
        unresolvedHumanThreads: unresolvedHuman.length,
        repliedHumanThreads: repliedHumanThreads.length,
      };

      if (humanReviews.length === 0) {
        return { status: 'awaiting-review', ciStatus: ciState, ...counts };
      }

      const latestHumanReview = humanReviews[humanReviews.length - 1];
      if (latestHumanReview.state === 'APPROVED') {
        return { status: 'approved', ciStatus: ciState, ...counts };
      }

      if (unresolvedHuman.length > 0) {
        const allReplied = unresolvedHuman.every((t) => {
          const comments = t.comments?.nodes ?? [];
          if (comments.length < 2) return false;
          const lastComment = comments[comments.length - 1];
          return lastComment.author?.login === this.user;
        });

        if (!allReplied) {
          return { status: 'changes-requested', ciStatus: ciState, ...counts };
        }
      }

      if (latestHumanReview.state === 'CHANGES_REQUESTED') {
        const lastCommitDate = pr.commits?.nodes?.[0]?.commit?.committedDate;
        const pushedSinceReview = lastCommitDate != null
          && lastCommitDate > latestHumanReview.submittedAt;

        if (!pushedSinceReview) {
          return { status: 'changes-requested', ciStatus: ciState, ...counts };
        }
      }

      return { status: 'awaiting-review', ciStatus: ciState, ...counts };
    } catch {
      return { status: 'awaiting-review', ...zeroCounts };
    }
  }

  async fetchPrsToReview(): Promise<PrInfo[]> {
    const raw = await this.execGh([
      'pr', 'list', '--repo', this.repo, '--state', 'open',
      '--json', 'number,title,author,createdAt,url,latestReviews,reviewDecision,mergeable,headRefName',
      '--limit', '50',
    ]);

    const prs = JSON.parse(raw) as GhPrWithReviews[];
    const candidates = prs.filter((pr) => {
      if (pr.author?.login === this.user) return false;
      return true;
    });

    const enriched: PrInfo[] = await Promise.all(
      candidates.map(async (pr) => {
        const [{ status: reviewStatus, ciStatus }, behindBy] = await Promise.all([
          this.classifyPrReview(pr.number),
          this.fetchBehindBy(pr.headRefName, pr.author?.login),
        ]);
        return {
          number: pr.number,
          title: pr.title,
          author: pr.author?.login,
          createdAt: pr.createdAt,
          url: pr.url,
          reviewDecision: pr.reviewDecision ?? 'PENDING',
          mergeable: pr.mergeable,
          behindBy,
          ciStatus,
          reviewStatus,
        };
      }),
    );

    this.toReviewCache = { data: enriched, lastUpdated: new Date().toISOString() };
    return enriched;
  }

  private async classifyPrReview(prNumber: number): Promise<{ status: ReviewStatus; ciStatus?: CiStatus }> {
    try {
      const raw = await this.execGh([
        'api', 'graphql',
        '-f', `query=${REVIEW_DETAILS_QUERY}`,
        '-f', `owner=${this.owner}`,
        '-f', `repo=${this.repoName}`,
        '-F', `number=${prNumber}`,
      ]);

      const data = JSON.parse(raw) as GraphQLResponse;
      const pr = data.data?.repository?.pullRequest;
      if (!pr) return { status: 'needs-your-review' };

      const ciState = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state as CiStatus | undefined;

      const yourReviews = (pr.reviews?.nodes ?? []).filter(
        (r) => r.author?.login === this.user,
      );

      if (yourReviews.length === 0) {
        return { status: 'needs-your-review', ciStatus: ciState };
      }

      const latestReview = yourReviews[yourReviews.length - 1];
      if (latestReview.state === 'APPROVED') {
        return { status: 'you-approved', ciStatus: ciState };
      }

      const lastCommitDate = pr.commits?.nodes?.[0]?.commit?.committedDate;
      const authorPushedSinceReview = lastCommitDate != null && lastCommitDate > latestReview.submittedAt;

      const reviewRequested = (pr.reviewRequests?.nodes ?? []).some(
        (rr) => rr.requestedReviewer?.login === this.user,
      );

      if (authorPushedSinceReview || reviewRequested) {
        return { status: 'needs-your-review', ciStatus: ciState };
      }

      const yourThreads = (pr.reviewThreads?.nodes ?? []).filter((t) => {
        const firstComment = t.comments?.nodes?.[0];
        return firstComment?.author?.login === this.user;
      });

      const unresolvedYourThreads = yourThreads.filter((t) => !t.isResolved);

      if (unresolvedYourThreads.length > 0) {
        const allReplied = unresolvedYourThreads.every((t) => {
          const comments = t.comments?.nodes ?? [];
          if (comments.length < 2) return false;
          const lastComment = comments[comments.length - 1];
          return lastComment.author?.login !== this.user;
        });

        if (allReplied) {
          return { status: 'needs-your-review', ciStatus: ciState };
        }
      }

      if (latestReview.state === 'COMMENTED' || latestReview.state === 'CHANGES_REQUESTED') {
        return { status: 'waiting-for-author', ciStatus: ciState };
      }

      return { status: 'needs-your-review', ciStatus: ciState };
    } catch (e) {
      console.warn(`[dev-helper] GraphQL review fetch failed for PR #${prNumber}:`, (e as Error).message);
      return { status: 'needs-your-review' };
    }
  }

  private async fetchBehindBy(branch: string, headOwner?: string): Promise<number> {
    try {
      const ref = headOwner ? `${headOwner}:${branch}` : branch;
      const raw = await this.execGh([
        'api', `repos/${this.repo}/compare/${this.baseBranch}...${ref}`,
        '--jq', '.behind_by',
      ]);
      return parseInt(raw, 10) || 0;
    } catch {
      return 0;
    }
  }

  private execGh(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('gh', args, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
}

type GhPrResult = {
  number: number;
  title: string;
  createdAt: string;
  url: string;
  reviewDecision: string | null;
  mergeable: string;
  headRefName: string;
};

type GhPrWithReviews = GhPrResult & {
  author: { login: string };
  latestReviews: { state: string; body?: string }[];
};

type GraphQLResponse = {
  data?: {
    repository?: {
      pullRequest?: {
        reviews?: {
          nodes: { author: { login: string }; state: string; submittedAt: string }[];
        };
        reviewThreads?: {
          nodes: {
            isResolved: boolean;
            comments?: {
              nodes: { author: { login: string } }[];
            };
          }[];
        };
        commits?: {
          nodes: { commit: { committedDate: string; statusCheckRollup?: { state: string } } }[];
        };
        reviewRequests?: {
          nodes: { requestedReviewer: { login: string } | null }[];
        };
      };
    };
  };
};
