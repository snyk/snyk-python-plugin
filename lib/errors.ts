export enum PythonPluginErrorNames {
  EMPTY_MANIFEST_ERROR = 'EMPTY_MANIFEST_ERROR',
  REQUIRED_PACKAGES_MISSING_ERROR = 'REQUIRED_PACKAGES_MISSING_ERROR',
  UNPARSABLE_REQUIREMENT_ERROR = 'UNPARSABLE_REQUIREMENT_ERROR',
  FAILED_TO_WRITE_TEMP_FILES = 'FAILED_TO_WRITE_TEMP_FILES',
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

export class UnparsableRequirementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = PythonPluginErrorNames.UNPARSABLE_REQUIREMENT_ERROR;
  }
}

export class FailedToWriteTempFiles extends Error {
  constructor(message: string) {
    super(message);
    this.name = PythonPluginErrorNames.FAILED_TO_WRITE_TEMP_FILES;
  }
}
