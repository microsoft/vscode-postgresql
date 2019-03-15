# PostgreSQL for Visual Studio Code

Welcome to PostgreSQL for Visual Studio Code! An extension for developing PostgreSQL with functionalities including:

* Connect to PostgreSQL instances
* Manage connection profiles
* Connect to a different Postgres instance or database in each tab
* View object DDL with 'Go to Definition' and 'Peek Definition'
* Run queries and save results as JSON, csv, or Excel


## Quickstart

1) Open the Command Palette (Ctrl + Shift + P).

2) Search and select 'PostgreSQL: New Query'

3) In the command palette, select 'Create Connection Profile'. Follow the prompts to enter your Postgres instance's hostname, database, username, and password.

You are now connected to your Postgres database. [You can confirm this via the Status Bar (the ribbon at the bottom of the VS Code window). It will show your connected hostname, database, and user.]

4) You can type a query like 'SELECT * FROM pg_stat_activity';

5) Right-click, select 'Execute Query' and the results will show in a new window.

You can save the query results to JSON, csv or Excel.


## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
