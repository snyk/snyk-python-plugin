export enum PythonPluginErrorNames {
  EMPTY_MANIFEST_ERROR = 'EMPTY_MANIFEST_ERROR',
  REQUIRED_PACKAGES_MISSING_ERROR = 'REQUIRED_PACKAGES_MISSING_ERROR',
}

export class EmptyManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = PythonPluginErrorNames.EMPTY_MANIFEST_ERROR;
  }
}

export class RequiredPackagesMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = PythonPluginErrorNames.REQUIRED_PACKAGES_MISSING_ERROR;
  }
}
