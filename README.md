# Nisaba Nexus Synthesis (NNS)

Nisaba Nexus Synthesis (NNS) is an Obsidian plugin that provides a unified interface for connecting to multiple AI providers. Inspired by the ancient Sumerian goddess of writing, learning, and wisdom—Nisaba—combined with the concept of a nexus (a central link or connection) and the process of synthesis, NNS unifies diverse AI capabilities under one seamless, secure API. We begin with text generation and plan to expand support for image, voice, and video functionalities over time.

---

## Overview

**Nisaba Nexus Synthesis (NNS)** is a lightweight bridge designed for Obsidian that abstracts the complexity of integrating with multiple AI services. By offering a single, standardized API, NNS allows developers and users to harness AI power without managing provider-specific details. This unified approach ensures secure communication, consistent responses, and a scalable platform for future multimodal integrations.

**Key Features:**

- **Unified API:** A consistent interface to interact with various AI providers.
- **Modular Architecture:** Start with text generation and easily extend to image, voice, and video generation.
- **Secure & Configurable:** Robust management of API keys, authentication, and settings within Obsidian.
- **Developer-Friendly:** Exposes a global API (e.g., `window.nns.invokeAI(prompt, options)`) for easy integration by other plugins.
- **Future-Proof:** Designed with scalability and extensibility in mind, ready to evolve as AI technologies advance.

---

## Installation

1. **Download the Plugin:**
   - Clone the [Nisaba Nexus Synthesis GitHub repository](https://github.com/beto-group/nns) or download the plugin package.

2. **Install in Obsidian:**
   - Open Obsidian and navigate to **Settings > Community Plugins > Install Plugin**.
   - Click **Load unpacked plugin** and select the folder where you saved the NNS plugin files.
   - Enable the plugin from the Community Plugins list.

3. **Configure Settings:**
   - Go to **Settings > Nisaba Nexus Synthesis Plugin**.
   - Enter your API keys and configure default parameters (default provider, temperature, max tokens, etc.).
   - Save your settings.

---

## Usage

1. **Trigger via Command Palette:**
   - Use Obsidian’s Command Palette to run the “Generate AI Text” command provided by NNS.
   - Enter your prompt and select the modality (initially, only "text" is supported).

2. **Global API Integration:**
   - NNS exposes a global API (e.g., `window.nns.invokeAI(prompt, options)`) that other plugins can call to access AI functionalities without handling provider-specific logic.
   - This makes it easy to build and extend AI features across your Obsidian workspace.

3. **Viewing and Utilizing Responses:**
   - Generated text is inserted directly into your notes or displayed in a modal window.
   - Future updates will add support for embedding images, playing synthesized voice output, or displaying video content.

---

## Architecture

NNS is built on a modular, layered architecture:

- **Client Layer:**  
  The Obsidian plugin and other third-party plugins send unified requests containing prompts and modality flags.
  
- **API Gateway:**  
  Acts as the central entry point for all requests. It handles authentication, configuration, logging, and caching before dispatching the request.

- **Request Dispatcher:**  
  Orchestrates the routing of standardized requests to the correct processing modules based on modality.

- **Modality Router & Multimodal Modules:**  
  These components determine the specific modality (text, image, voice, or video) requested and forward the request to the appropriate module that translates it into provider-specific API calls.

- **Provider Adapters:**  
  Abstract the differences between external AI providers by converting unified requests into provider-specific formats and aggregating the responses.

- **External AI Providers:**  
  Actual AI services (such as OpenAI, Anthropic, Google, etc.) that process the request and return the generated content.

This separation of concerns ensures that NNS remains lightweight and secure on the client side, while the heavy lifting is managed by well-isolated backend components.

---

## Roadmap

**Phase 1: Text Generation**
- Implement robust text generation capabilities using popular AI providers.
- Focus on secure configuration, error handling, logging, and a seamless user experience.

**Phase 2: Multimodal Expansion**
- **Image Generation:** Integrate image generation APIs (e.g., DALL-E) for creating visual content.
- **Voice Synthesis:** Add text-to-speech functionality to generate synthesized voice outputs.
- **Video Generation:** Enable video content generation and integration.
- Expand the global API to seamlessly support these new modalities.

**Future Extensions:**
- Enhance caching, rate limiting, and monitoring features.
- Provide extensive developer documentation and hooks for third-party plugin integration.
- Ensure continuous updates to meet emerging security and scalability standards.

---

## Contributing

We welcome contributions to Nisaba Nexus Synthesis! To get involved:

1. **Fork the Repository:**
   - Clone the project and create your own branch.

2. **Submit Pull Requests:**
   - Follow our coding guidelines.
   - Include clear descriptions and tests for your changes.
   - Submit your pull request on GitHub.

3. **Report Issues:**
   - Use the GitHub issues tracker to report bugs or suggest new features.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Contact

For questions, feedback, or support, please open an issue on the GitHub repository or email us at [obsidian888-nns@beto.group].

---

*Nisaba Nexus Synthesis (NNS) empowers Obsidian users and developers by providing a secure, unified, and extensible AI integration platform. Start with text generation today and look forward to robust multimodal capabilities in future updates!*
