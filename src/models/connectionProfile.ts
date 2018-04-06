'use strict';
import LocalizedConstants = require('../constants/localizedConstants');
import { IConnectionProfile } from './interfaces';
import { ConnectionCredentials } from './connectionCredentials';
import { QuestionTypes, IQuestion, IPrompter, INameValueChoice } from '../prompts/question';
import * as utils from './utils';

// Concrete implementation of the IConnectionProfile interface

/**
 * A concrete implementation of an IConnectionProfile with support for profile creation and validation
 */
export class ConnectionProfile extends ConnectionCredentials implements IConnectionProfile {
    public profileName: string;
    public savePassword: boolean;
    public emptyPasswordInput: boolean;

    /**
     * Creates a new profile by prompting the user for information.
     * @param  {IPrompter} prompter that asks user the questions needed to complete a profile
     * @param  {IConnectionProfile} (optional) default profile values that will be prefilled for questions, if any
     * @returns Promise - resolves to undefined if profile creation was not completed, or IConnectionProfile if completed
     */
    public static createProfile(prompter: IPrompter, defaultProfileValues?: IConnectionProfile): Promise<IConnectionProfile> {
        let profile: ConnectionProfile = new ConnectionProfile();
        // Ensure all core properties are entered
        let authOptions: INameValueChoice[] = ConnectionCredentials.getAuthenticationTypesChoice();
        if (authOptions.length === 1) {
            // Set default value as there is only 1 option
            profile.authenticationType = authOptions[0].value;
        }

        let questions: IQuestion[] = ConnectionCredentials.getRequiredCredentialValuesQuestions(profile, true, false, defaultProfileValues);
        // Check if password needs to be saved
        questions.push(
            {
                type: QuestionTypes.input,
                name: LocalizedConstants.profileNamePrompt,
                message: LocalizedConstants.profileNamePrompt,
                placeHolder: LocalizedConstants.profileNamePlaceholder,
                default: defaultProfileValues ? defaultProfileValues.profileName : undefined,
                onAnswered: (value) => {
                    // Fall back to a default name if none specified
                    profile.profileName = value ? value : undefined;
                }
        });

        return prompter.prompt(questions, true).then(answers => {
            if (answers && profile.isValidProfile()) {
                return profile;
            }
            // returning undefined to indicate failure to create the profile
            return undefined;
        });
    }

    // Assumption: having connection string or server + profile name indicates all requirements were met
    private isValidProfile(): boolean {
        return utils.isNotEmpty(this.host)
                    && utils.isNotEmpty(this.user);
    }
}
