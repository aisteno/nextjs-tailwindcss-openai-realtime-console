# OpenAI Realtime Console (Next.js Implementation)

A re-implementation of the [openai-realtime-console](https://github.com/openai/openai-realtime-console) built with Next.js and Tailwind CSS. This version maintains all the functionality you love while adding modern features and simplified deployment.

## 🚀 Quick Start

1. Install dependencies:

```shell
yarn install
```

2. Create a `.env.local` file:

```conf
OPENAI_API_KEY=YOUR_API_KEY
```

3. Start the development server:

```shell
yarn dev
```

Visit `localhost:3000` and you're ready to go! 🎉

## ✨ What's New?

- Built with **Next.js** for better performance and developer experience
- Styled with **Tailwind CSS** for modern, responsive design
- Integrated relay server - no separate setup needed! This is accomplished by using a custom Next.js server (see [Next.js Custom Server docs](https://nextjs.org/docs/pages/building-your-application/configuring/custom-server))

> **Important Note:** When starting the server with `node server.js`, the Next.js HMR (Hot Module Replacement) does not work. To work around this, use `yarn dev` during development and set the API key through `NEXT_PUBLIC_OPENAI_API_KEY`. For deployment, ensure that `NEXT_PUBLIC_OPENAI_API_KEY` is not defined, and use the relay server instead. Suggestions for avoiding this workaround are welcome.

## 🐳 Docker Support

We've included Docker support for easy deployment. Build and run with:

```shell
# Build the image
docker build -t realtime-console .

# Run the container
docker run -p 3000:3000 -e OPENAI_API_KEY=your_api_key realtime-console
```

## 🚀 Azure Deployment

We've included GitHub Actions for automated deployment to Azure App Service! You'll need these secrets in your GitHub repository:

```plaintext
AZURE_GITHUB_SP_CREDENTIALS // service principal allowed to login to your Azure subscription
OPENAI_API_KEY
ACR_LOGIN_SERVER
ACR_USERNAME
ACR_PASSWORD
AZUREAPPSERVICE_PUBLISHPROFILE // only needed if you're deployment requires authentication
WEBSITE_HOSTNAME // hostname of your app, eg. realtime-console-xyz.azurewebsites.net (this is set by default by Azure App Service)
```

The workflow can be triggered manually from the GitHub Actions interface on the `main` branch.

## 👥 Contributing

We love contributions! Whether it's:

- 🐛 Bug fixes
- ✨ Improvements
- 📚 Documentation improvements

Please feel free to:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the MIT License.

---

Built with ❤️ by [steno.ai](https://steno.ai). If you find this useful, check out our [other AI tools and services](https://steno.ai)! Happy coding! 🎉
