/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ErrorCodes } from './interfaces';

export class PlatformNotSupportedError extends Error {
    public static readonly message = '';
    public readonly code: ErrorCodes = ErrorCodes.ERR_PLATFORM_NOT_SUPPORTED;

    constructor(message?: string, public platform?: string) {
        super(message || PlatformNotSupportedError.message);
    }
}

export class ArchitectureNotSupportedError extends PlatformNotSupportedError {
    public static readonly message = '';
    public readonly code: ErrorCodes = ErrorCodes.ERR_ARCHITECTURE_NOT_SUPPORTED;

    constructor(message?: string, platform?: string, public architecture?: string) {
        super(message || ArchitectureNotSupportedError.message, platform);
    }
}

export class DistributionNotSupportedError extends PlatformNotSupportedError {
    public static readonly message = '';
    public readonly code: ErrorCodes = ErrorCodes.ERR_DISTRIBUTION_NOT_SUPPORTED;

    constructor(message?: string, platform?: string, public distribution?: string) {
        super(message || DistributionNotSupportedError.message, platform);
    }
}
