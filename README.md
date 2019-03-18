# PostgreSQL for Visual Studio Code

Welcome to PostgreSQL for Visual Studio Code! An extension for developing PostgreSQL with functionalities including:

* Connect to PostgreSQL instances
* Manage connection profiles
* Connect to a different Postgres instance or database in each tab
* View object DDL with 'Go to Definition' and 'Peek Definition'
* Write queries with IntelliSense
* Run queries and save results as JSON, csv, or Excel

Install link: https://marketplace.visualstudio.com/items?itemName=ms-ossdata.vscode-postgresql 

## Quickstart

1) Open the Command Palette (Ctrl + Shift + P).

2) Search and select 'PostgreSQL: New Query'

3) In the command palette, select 'Create Connection Profile'. Follow the prompts to enter your Postgres instance's hostname, database, username, and password.

You are now connected to your Postgres database. You can confirm this via the Status Bar (the ribbon at the bottom of the VS Code window). It will show your connected hostname, database, and user.

4) You can type a query like 'SELECT * FROM pg_stat_activity';

5) Right-click, select 'Execute Query' and the results will show in a new window.

You can save the query results to JSON, csv or Excel.

## Offline Installation
The extension will download and install a required PostgreSQL Tools Service package during activation. For machines with no Internet access, you can still use the extension by choosing the
`Install from VSIX...` option in the Extension view and installing a bundled release from our [Releases](https://github.com/Microsoft/vscode-postgresql/releases) page.
Each operating system has a .vsix file with the required service included. Pick the file for your OS, download and install to get started.
We recommend you choose a full release and ignore any alpha or beta releases as these are our daily builds used in testing.

## Support
Support for this extension is provided on our [GitHub Issue Tracker]. You can submit a [bug report], a [feature suggestion] or participate in [discussions].

## Contributing to the Extension
See the [developer documentation] for details on how to contribute to this extension.

## Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct]. For more information see the [Code of Conduct FAQ] or contact [opencode@microsoft.com] with any additional questions or comments.

## Privacy Statement
The [Microsoft Enterprise and Developer Privacy Statement] describes the privacy statement of this software.

## License
This extension is [licensed under the MIT License]. Please see the [third-party notices] file for additional copyright notices and license terms applicable to portions of the software.

[GitHub Issue Tracker]:https://github.com/Microsoft/vscode-postgresql/issues
[bug report]:https://github.com/Microsoft/vscode-postgresql/issues/new
[feature suggestion]:https://github.com/Microsoft/vscode-postgresql/issues/new
[developer documentation]:https://github.com/Microsoft/vscode-postgresql/wiki/How-to-Contribute
[Microsoft Enterprise and Developer Privacy Statement]:https://go.microsoft.com/fwlink/?LinkId=786907&lang=en7
[licensed under the MIT License]: https://github.com/Microsoft/vscode-postgresql/blob/master/LICENSE
[third-party notices]: https://github.com/Microsoft/vscode-postgresql/blob/master/ThirdPartyNotices.txt
[Microsoft Open Source Code of Conduct]:https://opensource.microsoft.com/codeofconduct/
[Code of Conduct FAQ]:https://opensource.microsoft.com/codeofconduct/faq/
[opencode@microsoft.com]:mailto:opencode@microsoft.com
