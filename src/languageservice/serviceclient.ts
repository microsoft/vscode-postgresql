/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import * as os from 'os';

import { ExtensionContext, workspace, window, OutputChannel, languages } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions,
    TransportKind, RequestType, NotificationType, NotificationHandler,
    ErrorAction, CloseAction } from 'vscode-languageclient';

import VscodeWrapper from '../controllers/vscodeWrapper';
import Telemetry from '../models/telemetry';
import * as Utils from '../models/utils';
import {VersionRequest} from '../models/contracts';
import {Logger} from '../models/logger';
import Constants = require('../constants/constants');
import ServerProvider from './server';
import ServiceDownloadProvider from './serviceDownloadProvider';
import DecompressProvider from './decompressProvider';
import HttpClient from './httpClient';
import ExtConfig from  '../configurations/extConfig';
import {PlatformInformation, getRuntimeDisplayName} from '../models/platform';
import {ServerInitializationResult, ServerStatusView} from './serverStatus';
import StatusView from '../views/statusView';
import * as LanguageServiceContracts from '../models/contracts/languageService';
import { IConfig } from '../languageservice/interfaces';

let vscode = require('vscode');
let opener = require('opener');

let _channel: OutputChannel = undefined;

/**
 * @interface IMessage
 */
interface IMessage {
    jsonrpc: string;
}


/**
 * Handle Language Service client errors
 * @class LanguageClientErrorHandler
 */
class LanguageClientErrorHandler {

    /**
     * Creates an instance of LanguageClientErrorHandler.
     * @memberOf LanguageClientErrorHandler
     */
    constructor(private vscodeWrapper?: VscodeWrapper) {
        if (!this.vscodeWrapper) {
            this.vscodeWrapper = new VscodeWrapper();
        }
    }

    /**
     * Show an error message prompt with a link to known issues wiki page
     * @memberOf LanguageClientErrorHandler
     */
    showOnErrorPrompt(): void {
        Telemetry.sendTelemetryEvent('SqlToolsServiceCrash');

        this.vscodeWrapper.showErrorMessage(
          Constants.sqlToolsServiceCrashMessage,
          Constants.sqlToolsServiceCrashButton).then(action => {
            if (action && action === Constants.sqlToolsServiceCrashButton) {
                opener(Constants.sqlToolsServiceCrashLink);
            }
        });
    }

    /**
     * Callback for language service client error
     *
     * @param {Error} error
     * @param {Message} message
     * @param {number} count
     * @returns {ErrorAction}
     *
     * @memberOf LanguageClientErrorHandler
     */
    error(error: Error, message: IMessage, count: number): ErrorAction {
        this.showOnErrorPrompt();

        // we don't retry running the service since crashes leave the extension
        // in a bad, unrecovered state
        return ErrorAction.Shutdown;
    }

    /**
     * Callback for language service client closed
     *
     * @returns {CloseAction}
     *
     * @memberOf LanguageClientErrorHandler
     */
    closed(): CloseAction {
        this.showOnErrorPrompt();

        // we don't retry running the service since crashes leave the extension
        // in a bad, unrecovered state
        return CloseAction.DoNotRestart;
    }
}

// The Service Client class handles communication with the VS Code LanguageClient
export default class SqlToolsServiceClient {
    // singleton instance
    private static _instance: SqlToolsServiceClient = undefined;

    // VS Code Language Client
    private _client: LanguageClient = undefined;
    // getter method for the Language Client
    private get client(): LanguageClient {
        return this._client;
    }

    private set client(client: LanguageClient) {
        this._client = client;
    }

    constructor(
        private _config: IConfig,
        private _server: ServerProvider,
        private _logger: Logger,
        private _statusView: StatusView,
        private _vscodeWrapper: VscodeWrapper) {
    }

    // gets or creates the singleton SQL Tools service client instance
    public static get instance(): SqlToolsServiceClient {
        if (this._instance === undefined) {
            let config = new ExtConfig();
            _channel = window.createOutputChannel(Constants.serviceInitializingOutputChannelName);
            let logger = new Logger(text => _channel.append(text));
            let serverStatusView = new ServerStatusView();
            let httpClient = new HttpClient();
            let decompressProvider = new DecompressProvider();
            let downloadProvider = new ServiceDownloadProvider(config, logger, serverStatusView, httpClient,
            decompressProvider);
            let serviceProvider = new ServerProvider(downloadProvider, config, serverStatusView);
            let vscodeWrapper = new VscodeWrapper();
            let statusView = new StatusView(vscodeWrapper);
            this._instance = new SqlToolsServiceClient(config, serviceProvider, logger, statusView, vscodeWrapper);
        }
        return this._instance;
    }

    // initialize the SQL Tools Service Client instance by launching
    // out-of-proc server through the LanguageClient
    public initialize(context: ExtensionContext): Promise<ServerInitializationResult> {
         this._logger.appendLine(Constants.serviceInitializing);

         return PlatformInformation.GetCurrent().then( platformInfo => {
            return this.initializeForPlatform(platformInfo, context);
         });
    }

    public initializeForPlatform(platformInfo: PlatformInformation, context: ExtensionContext): Promise<ServerInitializationResult> {
         return new Promise<ServerInitializationResult>( (resolve, reject) => {
            this._logger.appendLine(Constants.commandsNotAvailableWhileInstallingTheService);
            this._logger.appendLine();
            this._logger.append(`Platform-------------: ${platformInfo.toString()}`);
            if (!platformInfo.isValidRuntime) {
                this._logger.appendLine();
                this._logger.append('Platform invalid');
                Utils.showErrorMsg(Constants.unsupportedPlatformErrorMessage);
                Telemetry.sendTelemetryEvent('UnsupportedPlatform', {platform: platformInfo.toString()} );
                reject('Invalid Platform');
            } else {
                if (platformInfo.runtimeId) {
                    this._logger.appendLine(` (${getRuntimeDisplayName(platformInfo.runtimeId)})`);
                } else {
                    this._logger.appendLine();
                }
                this._logger.appendLine();

                this._server.getServerPath(platformInfo.runtimeId).then(async serverPath => {
                    this._logger.appendLine();
                    if (serverPath === undefined) {
                        // Check if the service already installed and if not open the output channel to show the logs
                        if (_channel !== undefined) {
                            _channel.show();
                        }
                        let installedServerPath = await this._server.downloadServerFiles(platformInfo.runtimeId);
                        this.initializeLanguageClient(installedServerPath, context);
                        await this._client.onReady();
                        resolve(new ServerInitializationResult(true, true, installedServerPath));
                    } else {
                        this.initializeLanguageClient(serverPath, context);
                        await this._client.onReady();
                        resolve(new ServerInitializationResult(false, true, serverPath));
                    }
                }).catch(err => {
                    Utils.logDebug(Constants.serviceLoadingFailed + ' ' + err );
                    Utils.showErrorMsg(Constants.serviceLoadingFailed);
                    Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
                    reject(err);
                });
            }
        });
    }


    /**
     * Gets the known service version of the backing tools service. This can be useful for filtering
     * commands that are not supported if the tools service is below a certain known version
     *
     * @returns {number}
     * @memberof SqlToolsServiceClient
     */
    public getServiceVersion(): number {
        return this._config.getServiceVersion();
    }

    /**
     * Initializes the SQL language configuration
     *
     * @memberOf SqlToolsServiceClient
     */
    private initializeLanguageConfiguration(): void {
        languages.setLanguageConfiguration('sql', {
            comments: {
                lineComment: '--',
                blockComment: ['/*', '*/']
            },

            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')']
            ],

            __characterPairSupport: {
                autoClosingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"', notIn: ['string'] },
                    { open: '\'', close: '\'', notIn: ['string', 'comment'] }
                ]
            }
        });
    }

    private initializeLanguageClient(serverPath: string, context: ExtensionContext): void {
         if (serverPath === undefined) {
                Utils.logDebug(Constants.invalidServiceFilePath);
                throw new Error(Constants.invalidServiceFilePath);
         } else {
            let self = this;
            self.initializeLanguageConfiguration();
            let serverOptions: ServerOptions = this.createServerOptions(serverPath);
            this.client = this.createLanguageClient(serverOptions);

            if (context !== undefined) {
                // Create the language client and start the client.
                let disposable = this.client.start();

                // Push the disposable to the context's subscriptions so that the
                // client can be deactivated on extension deactivation

                context.subscriptions.push(disposable);
            }
         }
    }

    private createLanguageClient(serverOptions: ServerOptions): LanguageClient {
        // Options to control the language client
        let clientOptions: LanguageClientOptions = {
            documentSelector: ['sql'],
            synchronize: {
                configurationSection: 'pgsql'
            },
            errorHandler: new LanguageClientErrorHandler(this._vscodeWrapper)
        };

        // cache the client instance for later use
        let client = new LanguageClient(Constants.sqlToolsServiceName, serverOptions, clientOptions);
        client.onReady().then( () => {
            this.checkServiceCompatibility();

            client.onNotification(LanguageServiceContracts.TelemetryNotification.type, this.handleLanguageServiceTelemetryNotification());
            client.onNotification(LanguageServiceContracts.StatusChangedNotification.type, this.handleLanguageServiceStatusNotification());
        });

        return client;
    }

     private handleLanguageServiceTelemetryNotification(): NotificationHandler<LanguageServiceContracts.TelemetryParams> {
        return (event: LanguageServiceContracts.TelemetryParams): void => {
            Telemetry.sendTelemetryEvent(event.params.eventName, event.params.properties, event.params.measures);
        };
    }

    /**
     * Public for testing purposes only.
     */
    public handleLanguageServiceStatusNotification(): NotificationHandler<LanguageServiceContracts.StatusChangeParams> {
        return (event: LanguageServiceContracts.StatusChangeParams): void => {
            this._statusView.languageServiceStatusChanged(event.ownerUri, event.status);
        };
    }

    private createServerOptions(servicePath): ServerOptions {
        let serverArgs = [];
        let serverCommand: string = servicePath;

        let config = workspace.getConfiguration(Constants.extensionConfigSectionName);

        if (config) {
            // Override the server path with the local debug path if enabled

            let useLocalSource = config['useDebugSource'];
            if (useLocalSource) {
                let localSourcePath = config['debugSourcePath'];
                let filePath = path.join(localSourcePath, 'pgsqltoolsservice/pgtoolsservice_main.py');
                process.env.PYTHONPATH = localSourcePath;
                serverCommand = process.platform === 'win32' ? 'python' : 'python3';

                let enableStartupDebugging = config['enableStartupDebugging'];
                let debuggingArg = enableStartupDebugging ? '--enable-remote-debugging-wait' : '--enable-remote-debugging';
                let debugPort = config['debugServerPort'];
                debuggingArg += '=' + debugPort;
                serverArgs = [filePath, debuggingArg];
            }

            let logFileLocation = path.join(this.getDefaultLogLocation(), 'pgsql');

            serverArgs.push('--log-dir=' + logFileLocation);
            serverArgs.push(logFileLocation);

            // Enable diagnostic logging in the service if it is configured
            let logDebugInfo = config['logDebugInfo'];
            if (logDebugInfo) {
                serverArgs.push('--enable-logging');
            }
            let applyLocalization = config[Constants.configApplyLocalization];
            if (applyLocalization) {
                let locale = vscode.env.language;
                serverArgs.push('--locale');
                serverArgs.push(locale);
            }
        }

        // run the service host
        return  {  command: serverCommand, args: serverArgs, transport: TransportKind.stdio  };
    }

    /**
     * Send a request to the service client
     * @param type The of the request to make
     * @param params The params to pass with the request
     * @returns A thenable object for when the request receives a response
     */
    public sendRequest<P, R, E, R0>(type: RequestType<P, R, E, R0>, params?: P): Thenable<R> {
        if (this.client !== undefined) {
            return this.client.sendRequest(type, params);
        }
    }

    /**
     * Send a notification to the service client
     * @param params The params to pass with the notification
     */
    public sendNotification<P, R0>(type: NotificationType<P, R0>, params?: P): void {
        if (this.client !== undefined) {
            this.client.sendNotification(type, params);
        }
    }

    /**
     * Register a handler for a notification type
     * @param type The notification type to register the handler for
     * @param handler The handler to register
     */
    public onNotification<P, R0>(type: NotificationType<P, R0>, handler: NotificationHandler<P>): void {
        if (this._client !== undefined) {
             return this.client.onNotification(type, handler);
        }
    }

    public checkServiceCompatibility(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this._client.sendRequest(VersionRequest.type, undefined).then((result) => {
                Utils.logDebug('sqlserverclient version: ' + result);
                // TODO: Add code to validate the version
                resolve(true);
            });
        });
    }

    // The function is a duplicate of \src\paths.js. IT would be better to import path.js but it doesn't
    // work for now because the extension is running in different process.
    private getAppDataPath(): string {
        let platform = process.platform;
        switch (platform) {
            case 'win32': return process.env['APPDATA'] || path.join(process.env['USERPROFILE'], 'AppData', 'Roaming');
            case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support');
            case 'linux': return process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
            default: throw new Error('Platform not supported');
        }
    }

    private getDefaultLogLocation(): string {
        return path.join(this.getAppDataPath(), 'code');
    }
}
