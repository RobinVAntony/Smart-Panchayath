let USER = null;

const districtSelect = document.getElementById('districtSelect');
const blockSelect = document.getElementById('blockSelect');
const panchayatSelect = document.getElementById('panchayatSelect');

document.addEventListener('DOMContentLoaded', async () => {
  const res = await authFetch('/me');
  if (!res) return;

  USER = await res.json();

  // 🔴 Panchayat admin → direct dashboard
  if (USER.role === 'panchayat_admin') {
    window.location.href = `index.html?panchayatId=${USER.panchayatId}`;
    return;
  }
  

  // 🟠 Block admin
  if (USER.role === 'block_admin') {
    hide('districtGroup');
    hide('blockGroup');

    await loadPanchayats(USER.blockId);
    return;
  }

  // 🟡 District admin
  if (USER.role === 'district_admin') {
    hide('districtGroup');

    await loadBlocks(USER.districtId);
    return;
  }

  // 🟢 State admin
  if (USER.role === 'state_admin') {
    await loadDistricts();
  }
});

/* ---------------- LOADERS ---------------- */

async function loadDistricts() {
  const res = await authFetch('/districts');
  const districts = await res.json();

  fillSelect(districtSelect, districts);
  districtSelect.onchange = () => {
    clear(blockSelect);
    clear(panchayatSelect);
    loadBlocks(districtSelect.value);
  };
}

async function loadBlocks(districtId) {
  const res = await authFetch(`/blocks?districtId=${districtId}`);
  const blocks = await res.json();

  fillSelect(blockSelect, blocks);
  blockSelect.onchange = () => {
    clear(panchayatSelect);
    loadPanchayats(blockSelect.value);
  };
}

async function loadPanchayats(blockId) {
  const res = await authFetch(`/panchayats?blockId=${blockId}`);
  const panchayats = await res.json();

  fillSelect(panchayatSelect, panchayats);
}

/* ---------------- UTIL ---------------- */

function fillSelect(select, items) {
  select.innerHTML = '<option value="">Select</option>';
  items.forEach(i => {
    select.innerHTML += `<option value="${i.id}">${i.name}</option>`;
  });
}

function clear(select) {
  select.innerHTML = '<option value="">Select</option>';
}

function hide(id) {
  document.getElementById(id).style.display = 'none';
}

/* ---------------- NAV ---------------- */

function openDashboard() {
  const panchayatSelect = document.getElementById('panchayatSelect');
  const panchayatId = panchayatSelect.value;

  if (!panchayatId) {
    alert('Please select a panchayat');
    return;
  }

  // 🔹 READ SELECTED NAMES (UI CONTEXT)
  const panchayatName =
    panchayatSelect.options[panchayatSelect.selectedIndex].text;

  const blockName =
    blockSelect && blockSelect.selectedIndex > 0
      ? blockSelect.options[blockSelect.selectedIndex].text
      : null;

  const districtName =
    districtSelect && districtSelect.selectedIndex > 0
      ? districtSelect.options[districtSelect.selectedIndex].text
      : null;

  // 🔹 PASS CONTEXT FOR DASHBOARD HEADER
  window.location.href =
    `index.html?panchayatId=${panchayatId}` +
    `&districtName=${encodeURIComponent(districtName || '')}` +
    `&blockName=${encodeURIComponent(blockName || '')}` +
    `&panchayatName=${encodeURIComponent(panchayatName)}`;
}



