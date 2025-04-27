export const consoleCSS = `
.ai-console-container {
  padding: 20px;
  max-width: 900px;
  margin: auto;
  background: var(--background-primary);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.ai-console-tab-selector {
  display: flex;
  gap: 0;
  margin-bottom: 0;
  background: #2F2F2F;
  padding: 0;
  border-bottom: 1px solid var(--background-modifier-border);
  flex-wrap: nowrap; /* Prevent wrapping to ensure all tabs are visible */
  overflow-x: auto; /* Allow horizontal scrolling if tabs overflow */
  -webkit-overflow-scrolling: touch; /* Smooth scrolling on touch devices */
}

/* Custom Scrollbar Styling */
.ai-console-tab-selector::-webkit-scrollbar {
  height: 4px; /* Slimmer scrollbar */
}

.ai-console-tab-selector::-webkit-scrollbar-track {
  background: #2F2F2F; /* Match the background of the tab selector */
}

.ai-console-tab-selector::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border); /* Subtle thumb color */
  border-radius: 2px;
}

.ai-console-tab-selector::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted); /* Slightly lighter on hover */
}

.ai-console-tab-button {
  display: flex;
  align-items: center;
  gap: 8px; /* Gap between icon and label */
  padding: 8px 14px; /* Increased padding for better spacing */
  border: none;
  border-right: 1px solid var(--background-modifier-border);
  background: #2F2F2F;
  color: var(--text-faint);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  text-align: center;
  justify-content: center;
  opacity: 0.4;
  min-width: 70px; /* Slightly increased min-width for better spacing */
  white-space: nowrap; /* Prevent text wrapping */
  flex-shrink: 0; /* Prevent the button from shrinking too much */
}

.ai-console-tab-button:last-child {
  border-right: none;
}

.ai-console-tab-button:hover:not(.active) {
  background: #3A3A3A;
  color: var(--text-muted);
  opacity: 0.6;
}

.ai-console-tab-button.active {
  background: var(--background-primary);
  color: var(--text-normal);
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  border-bottom: none;
  position: relative;
  z-index: 1;
  opacity: 1;
}

.ai-console-tab-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0; /* Prevent icon from shrinking */
}

.ai-console-tab-icon svg {
  fill: currentColor;
  stroke: currentColor;
  opacity: inherit;
}

.ai-console-tab-label {
  display: inline-block;
  flex-shrink: 0; /* Prevent label from shrinking */
}

.ai-console-tab-content {
  padding: 16px;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-top: none;
  border-radius: 0 0 6px 6px;
}

.ai-console-controls {
  margin-bottom: 20px;
  padding: 15px;
  background: var(--background-secondary);
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
}

.ai-console-controls h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: var(--text-normal);
}

.ai-console-params {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid var(--background-modifier-border);
}

.ai-console-params h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: var(--text-normal);
}

.ai-console-prompt-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: flex-end;
}

.ai-console-prompt {
  flex: 1;
  width: 100%;
  height: 120px;
  padding: 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary-alt);
  color: var(--text-normal);
  font-size: 14px;
  resize: vertical;
  transition: border-color 0.2s ease;
}

.ai-console-prompt:focus {
  border-color: var(--interactive-accent);
  outline: none;
}

.ai-console-run-btn {
  padding: 10px 20px;
  background: var(--interactive-accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.ai-console-run-btn:hover {
  background: var(--interactive-accent-hover);
}

.ai-console-output-section {
  margin-bottom: 20px;
}

.ai-console-output-section h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: var(--text-normal);
}

.ai-console-output {
  padding: 15px;
  background: var(--background-secondary);
  border-radius: 6px;
  min-height: 120px;
  white-space: pre-wrap;
  border: 1px solid var(--background-modifier-border);
  font-size: 14px;
  color: var(--text-normal);
}

.ai-console-code {
  margin-top: 10px;
  padding: 15px;
  background: var(--code-block-background);
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  color: var(--text-muted);
  border: 1px solid var(--background-modifier-border);
}

.ai-console-history {
  margin-top: 20px;
  padding: 15px;
  background: var(--background-secondary);
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
}

.ai-console-history h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: var(--text-normal);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.ai-console-history-list {
  list-style: none;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
}

.ai-console-history-list li {
  padding: 10px;
  border-bottom: 1px solid var(--background-modifier-border);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-normal);
  transition: background 0.2s ease;
}

.ai-console-history-list li:hover {
  background: var(--background-modifier-hover);
}

.ai-console-history-list li:last-child {
  border-bottom: none;
}

.ai-console-history-list strong {
  color: var(--text-accent);
}

.ai-console-history-list span {
  color: var(--text-muted);
}
.ai-console-controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: nowrap;
}

.ai-console-controls-spacer {
  flex-grow: 1;
}
`;