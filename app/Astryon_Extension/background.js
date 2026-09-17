chrome.action.onClicked.addListener(async (tab) => {
  // Verify we're on a supported AI chat domain
  const isSupported = tab.url && (
    tab.url.includes('chatgpt.com') ||
    tab.url.includes('chat.openai.com') ||
    tab.url.includes('claude.ai')
  );
  if (!isSupported) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
    return;
  }

  try {
    // Inject content script and get scraped data
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    const data = results?.[0]?.result;

    if (!data || !data.messages || data.messages.length === 0) {
      chrome.action.setBadgeText({ text: '0' });
      chrome.action.setBadgeBackgroundColor({ color: '#e67e22' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
      return;
    }

    // Show success badge with message count
    chrome.action.setBadgeText({ text: String(data.messages.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#2ecc71' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);

    // Open Astryon import page, then inject data into its localStorage
    const importMode = data.highlightedSection ? 'highlight' : 'conversation';
    const astroyonUrl = `http://localhost:3000/explore?import=${importMode}`;
    const newTab = await chrome.tabs.create({ url: astroyonUrl });

    const storageKey = importMode === 'highlight' ? 'astryon_highlight_import' : 'astryon_import';

    // Wait for the Astryon page to finish loading, then write to its localStorage
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === newTab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);

        // Inject a script that writes the data to the page's localStorage.
        // BETA-06: scope the key to the app's active account namespace so a
        // pending import never leaks across accounts. The marker holds only the
        // namespace id (never user data). Poll briefly for the marker because
        // the app session may still be resolving when the page finishes loading.
        chrome.scripting.executeScript({
          target: { tabId: newTab.id },
          func: (jsonData, key) => {
            const marker = 'aurora-active-namespace';
            const targetKey = () => {
              let ns = null;
              try {
                ns = window.localStorage.getItem(marker);
              } catch (e) {
                ns = null;
              }
              return ns ? key + ':' + ns : key;
            };
            // Wait up to ~3s for the app to publish its active namespace marker.
            const deadline = Date.now() + 3000;
            const write = () => {
              const k = targetKey();
              window.localStorage.setItem(k, JSON.stringify(jsonData));
              window.dispatchEvent(new StorageEvent('storage', {
                key: k,
                newValue: JSON.stringify(jsonData)
              }));
            };
            if (targetKey() !== key) {
              write();
              return;
            }
            const timer = setInterval(() => {
              if (targetKey() !== key || Date.now() >= deadline) {
                clearInterval(timer);
                write();
              }
            }, 100);
          },
          args: [data, storageKey]
        });
      }
    });
  } catch (err) {
    console.error('Astryon scrape failed:', err);
    chrome.action.setBadgeText({ text: 'X' });
    chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
  }
});
