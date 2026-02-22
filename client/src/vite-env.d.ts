/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
