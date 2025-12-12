chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "downloadXmlLinks" && Array.isArray(message.urls)) {
    const urls = [...new Set(message.urls)].filter(Boolean);
    urls.forEach((url, index) => {
      setTimeout(() => {
        try {
          chrome.downloads.download({ url }, () => {});
        } catch (e) {}
      }, index * 250);
    });
    sendResponse({ started: true, count: urls.length });
    return true;
  }
});
