'use strict';
import * as TypeMoq from 'typemoq';
import { IConnectionCredentials, IConnectionProfile, AuthenticationTypes } from '../src/models/interfaces';
import { ConnectionCredentials } from '../src/models/connectionCredentials';
import { ConnectionProfile } from '../src/models/connectionProfile';
import { IQuestion, IPrompter } from '../src/prompts/question';
import { TestPrompter } from './stubs';
import { ConnectionUI } from '../src/views/connectionUI';
import { ConnectionStore } from '../src/models/connectionStore';
import ConnectionManager from '../src/controllers/connectionManager';
import VscodeWrapper from '../src/controllers/vscodeWrapper';

import LocalizedConstants = require('../src/constants/localizedConstants');
import assert = require('assert');

function createTestCredentials(): IConnectionCredentials {
    const creds: IConnectionCredentials = {
        host:                           'my-server',
        dbname:                         'my_db',
        user:                           'sa',
        password:                       '12345678',
        port:                           1234,
        authenticationType:             AuthenticationTypes[AuthenticationTypes.SqlLogin],
        encrypt:                        false,
        trustServerCertificate:         false,
        persistSecurityInfo:            false,
        connectTimeout:                 15,
        connectRetryCount:              0,
        connectRetryInterval:           0,
        applicationName:                'vscode-pgsql',
        workstationId:                  'test',
        applicationIntent:              '',
        currentLanguage:                '',
        pooling:                        true,
        maxPoolSize:                    15,
        minPoolSize:                    0,
        loadBalanceTimeout:             0,
        replication:                    false,
        attachDbFilename:               '',
        failoverPartner:                '',
        multiSubnetFailover:            false,
        multipleActiveResultSets:       false,
        packetSize:                     8192,
        typeSystemVersion:              'Latest',
        connectionString:               '',
        hostaddr:                       '',
        clientEncoding:                 '',
        options:                        '',
        sslmode:                        'prefer',
        sslcompression:                 false,
        sslcert:                        '',
        sslkey:                         '',
        sslrootcert:                    '',
        sslcrl:                         '',
        requirepeer:                    '',
        service:                        ''
    };
    return creds;
}

suite('Connection Profile tests', () => {

    setup(() => {
        // No setup currently needed
    });

    test('CreateProfile should ask questions in correct order', done => {
        // Given
        let prompter: TypeMoq.IMock<IPrompter> = TypeMoq.Mock.ofType(TestPrompter);
        let answers: {[key: string]: string} = {};
        let profileQuestions: IQuestion[];
        let profileReturned: IConnectionProfile;

        // When createProfile is called and user cancels out
        prompter.setup(x => x.prompt(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .callback(questions => {
                    // Capture questions for verification
                    profileQuestions = questions;
                })
                .returns(questions => {
                    //
                    return Promise.resolve(answers);
                });

        ConnectionProfile.createProfile(prompter.object)
            .then(profile => profileReturned = profile);

        // Then expect the following flow:
        let questionNames: string[] = [
            LocalizedConstants.serverPrompt,     // Server
            LocalizedConstants.databasePrompt,   // DB Name
            LocalizedConstants.usernamePrompt,   // UserName
            LocalizedConstants.passwordPrompt,   // Password
            LocalizedConstants.profileNamePrompt // Profile Name
        ];

        assert.strictEqual(profileQuestions.length, questionNames.length, 'unexpected number of questions');
        for (let i = 0; i < profileQuestions.length; i++) {
            assert.strictEqual(profileQuestions[i].name, questionNames[i], `Missing question for ${questionNames[i]}`);
        }
        // And expect result to be undefined as questions were not answered
        assert.strictEqual(profileReturned, undefined);
        done();
    });

    test('Port number is applied to server name when connection credentials are transformed into details', () => {
        // Given a connection credentials object with server and a port
        let creds = new ConnectionCredentials();
        creds.host = 'my-server';
        creds.port = 1234;

        // When credentials are transformed into a details contract
        const details = ConnectionCredentials.createConnectionDetails(creds);

        // Server name should be in the format <address>,<port>
        assert.strictEqual(details.options['host'], 'my-server,1234');
    });

    test('All connection details properties can be set from connection credentials', () => {
        const creds = createTestCredentials();
        const details = ConnectionCredentials.createConnectionDetails(creds);

        assert.notStrictEqual(typeof details.options['dbname'], 'undefined');
        assert.notStrictEqual(typeof details.options['password'], 'undefined');
        assert.notStrictEqual(typeof details.options['host'], 'undefined');
        assert.notStrictEqual(typeof details.options['user'], 'undefined');

    });

    test('Profile is connected to and validated prior to saving', done => {
        let connectionManagerMock: TypeMoq.IMock<ConnectionManager> = TypeMoq.Mock.ofType(ConnectionManager);
        connectionManagerMock.setup(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(true));

        let connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore);
        connectionStoreMock.setup(x => x.saveProfile(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));

        let prompter: TypeMoq.IMock<IPrompter> = TypeMoq.Mock.ofType(TestPrompter);
        prompter.setup(x => x.prompt(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(questions => {
                    let answers: {[key: string]: string} = {};
                    answers[LocalizedConstants.serverPrompt] = 'my-server';
                    answers[LocalizedConstants.databasePrompt] = 'my_db';
                    answers[LocalizedConstants.usernamePrompt] = 'sa';
                    answers[LocalizedConstants.passwordPrompt] = '12345678';
                    answers[LocalizedConstants.authTypePrompt] = AuthenticationTypes[AuthenticationTypes.SqlLogin];
                    for (let key in answers) {
                        if (answers.hasOwnProperty(key)) {
                            questions.map(q => { if (q.name === key) { q.onAnswered(answers[key]); } });
                        }
                    }
                    return Promise.resolve(answers);
                });

        let vscodeWrapperMock = TypeMoq.Mock.ofType(VscodeWrapper);
        vscodeWrapperMock.setup(x => x.activeTextEditorUri).returns(() => 'test.sql');

        let connectionUI = new ConnectionUI(connectionManagerMock.object, connectionStoreMock.object, prompter.object, vscodeWrapperMock.object);

        // create a new connection profile
        connectionUI.createAndSaveProfile().then(profile => {
            // connection is attempted
            connectionManagerMock.verify(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());

            // profile is saved
            connectionStoreMock.verify(x => x.saveProfile(TypeMoq.It.isAny()), TypeMoq.Times.once());

            done();
        }).catch(err => {
            done(err);
        });
    });

    test('Profile is not saved when connection validation fails', done => {
        let connectionManagerMock: TypeMoq.IMock<ConnectionManager> = TypeMoq.Mock.ofType(ConnectionManager);
        connectionManagerMock.setup(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(false));

        let connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore);
        connectionStoreMock.setup(x => x.saveProfile(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));

        let prompter: TypeMoq.IMock<IPrompter> = TypeMoq.Mock.ofType(TestPrompter);
        prompter.setup(x => x.prompt(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(questions => {
                    let answers: {[key: string]: string} = {};
                    answers[LocalizedConstants.serverPrompt] = 'my-server';
                    answers[LocalizedConstants.databasePrompt] = 'my_db';
                    answers[LocalizedConstants.usernamePrompt] = 'sa';
                    answers[LocalizedConstants.passwordPrompt] = '12345678';
                    answers[LocalizedConstants.authTypePrompt] = AuthenticationTypes[AuthenticationTypes.SqlLogin];
                    for (let key in answers) {
                        if (answers.hasOwnProperty(key)) {
                            questions.map(q => { if (q.name === key) { q.onAnswered(answers[key]); } });
                        }
                    }
                    return Promise.resolve(answers);
                });

        let vscodeWrapperMock = TypeMoq.Mock.ofType(VscodeWrapper);
        vscodeWrapperMock.setup(x => x.activeTextEditorUri).returns(() => 'test.sql');
        vscodeWrapperMock.setup(x => x.showErrorMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));

        let connectionUI = new ConnectionUI(connectionManagerMock.object, connectionStoreMock.object, prompter.object, vscodeWrapperMock.object);

        // create a new connection profile
        connectionUI.createAndSaveProfile().then(profile => {
            // connection is attempted
            connectionManagerMock.verify(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());

            // profile is not saved
            connectionStoreMock.verify(x => x.saveProfile(TypeMoq.It.isAny()), TypeMoq.Times.never());

            done();
        }).catch(err => {
            done(err);
        });
    });
});

