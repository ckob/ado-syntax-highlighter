const hostInput = document.getElementById('host-input');
const addHostBtn = document.getElementById('add-host-btn');
const hostsList = document.getElementById('hosts-list');
const defaultHostsList = document.getElementById('default-hosts-list');

function createCustomHostListItem(host) {
  const listItem = document.createElement('li');
  listItem.textContent = host;

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.style.marginLeft = '10px';
  removeBtn.addEventListener('click', () => removeHost(host));

  listItem.appendChild(removeBtn);
  hostsList.appendChild(listItem);
}

function loadDefaultHosts() {
  const manifest = chrome.runtime.getManifest();
  const defaultHosts = manifest.host_permissions || [];

  defaultHostsList.innerHTML = '';
  defaultHosts.forEach(host => {
    const listItem = document.createElement('li');
    listItem.textContent = host;
    defaultHostsList.appendChild(listItem);
  });
}

async function loadCustomHosts() {
  const { customHosts = [] } = await chrome.storage.sync.get('customHosts');
  hostsList.innerHTML = ''; // Clear the list before populating
  customHosts.forEach(createCustomHostListItem);
}

async function addHost() {
  let hostValue = hostInput.value.trim();
  if (!hostValue) return;

  hostValue = hostValue.replace(/\/+$/, '');

  const permissionPattern = `*://${hostValue}/*`;

  try {
    const granted = await chrome.permissions.request({
      origins: [permissionPattern]
    });

    if (granted) {
      const { customHosts = [] } = await chrome.storage.sync.get('customHosts');
      if (!customHosts.includes(permissionPattern)) {
        const updatedHosts = [...customHosts, permissionPattern];
        await chrome.storage.sync.set({ customHosts: updatedHosts });
        createCustomHostListItem(permissionPattern);
      }
      hostInput.value = '';
    } else {
      console.warn('Permission was not granted by the user.');
    }
  } catch (err) {
    console.error(`Error requesting permission: ${err}`);

    alert(`Could not request permission for "${hostValue}". Please ensure it's a valid hostname.`);
  }
}

async function removeHost(hostToRemove) {
  try {
    const removed = await chrome.permissions.remove({
      origins: [hostToRemove]
    });

    if (removed) {
      const { customHosts = [] } = await chrome.storage.sync.get('customHosts');
      const updatedHosts = customHosts.filter(h => h !== hostToRemove);
      await chrome.storage.sync.set({ customHosts: updatedHosts });
      loadCustomHosts();
    } else {
      console.warn('Could not remove permission.');
    }
  } catch (err) {
    console.error(`Error removing permission: ${err}`);
  }
}

addHostBtn.addEventListener('click', addHost);

hostInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addHost();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadDefaultHosts();
  loadCustomHosts();
});