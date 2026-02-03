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
    const astroyonUrl = 'http://localhost:3000/explore?import=conversation';
    const newTab = await chrome.tabs.create({ url: astroyonUrl });

    // Wait for the Astryon page to finish loading, then write to its localStorage
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === newTab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);

        // Inject a script that writes the data to the page's localStorage
        chrome.scripting.executeScript({
          target: { tabId: newTab.id },
          func: (jsonData) => {
            localStorage.setItem('astryon_import', JSON.stringify(jsonData));
            // Dispatch a storage event so the React app can detect it
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'astryon_import',
              newValue: JSON.stringify(jsonData)
            }));
          },
          args: [data]
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
