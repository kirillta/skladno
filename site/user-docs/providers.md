# AI providers and models

Skladno sends AI requests to the provider configured in **Settings → AI assistant**. You need an account and API key from that provider. Provider charges may apply.

## Add a connection

In the desktop app, open **Settings → AI assistant**. Under **How would you like to provide your key?**, choose **Add an API key** or **Environment variable**.

For **API key**, choose a provider, enter a connection name and paste the key. Skladno stores it in Windows Credential Manager on Windows or Secret Service on Linux. The key is not shown again or written to Skladno's database or backups. Managed credentials require the desktop app and an available OS credential service. On Linux, its Secret Service must be unlocked.

For **Environment variable**, choose a provider, enter a connection name and the variable name that contains your key, then add the connection. Skladno stores the variable name, not its value. The application service must be launched with that variable set. The installer does not create or import a `.env` file.

The browser version supports environment-variable connections. It cannot create or manage OS-stored API keys.

Adding an environment-variable connection only saves its settings. Adding an API-key connection verifies the key with the provider. Skladno also contacts the provider when you refresh models or make an AI request. These checks do not send Article content. If model refresh fails, check that the connection is active, the variable is available to the application service or the saved key is valid, and the provider account can access its API.

## Choose providers and models

Skladno supports OpenAI, OpenCode Zen, Anthropic, Google Gemini API, xAI Grok, and DeepSeek. OpenCode Zen also offers models from vendors in its catalog.

Connections marked **Active** contribute models to the model list. In **Settings → AI assistant**, select **Refresh available models**, then choose a **Default model**. You can also assign models to individual Skills under **Models for specific tasks**. A task set to **Use default model** uses the Default model.

Available Editorial Operations depend on the model. Sourced fact checking, structured output, and reasoning controls may be unavailable for some models. OpenCode Zen models use their catalog's capabilities and availability.

### App model

The **App model** setting chooses a separate model for Skladno's short helper tasks, such as Proposal summaries, titles, and understanding Assistant request intent. If you leave it unset, Skladno uses the Default model.

Choose an efficient, lower-cost text model for this setting. **GPT-6 Luna** is a good OpenAI option for focused, high-volume tasks ([model details](https://developers.openai.com/api/docs/models/gpt-6-luna)). With another provider, choose a comparable efficient model. These short helper tasks usually do not need a more expensive model. If their results are poor, try a stronger model.
