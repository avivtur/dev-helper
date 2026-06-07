type VsCodeApi = {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (api) {
    return api;
  }

  if (typeof acquireVsCodeApi === 'function') {
    api = acquireVsCodeApi();
    return api!;
  }

  api = {
    postMessage: (msg: unknown) => console.log('[mock postMessage]', msg),
    getState: () => ({}),
    setState: (state: unknown) => console.log('[mock setState]', state),
  };
  return api;
}

declare function acquireVsCodeApi(): VsCodeApi;
