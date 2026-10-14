declare module "occt-import-js" {
  interface OcctReadParams {
    linearUnit?: string;
    linearDeflectionType?: string;
    linearDeflection?: number;
    angularDeflection?: number;
  }

  interface OcctModule {
    ReadBrepFile(data: Uint8Array, params: OcctReadParams | null): unknown;
    ReadStepFile(data: Uint8Array, params: OcctReadParams | null): unknown;
    ReadIgesFile(data: Uint8Array, params: OcctReadParams | null): unknown;
  }

  interface OcctConfig {
    locateFile?: (path: string, prefix?: string) => string;
  }

  const factory: (config?: OcctConfig) => Promise<OcctModule>;
  export default factory;
}
