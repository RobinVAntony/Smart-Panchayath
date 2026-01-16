console.log('API Base:', API_BASE);


console.log('Mobile Debug Info:');
console.log('User Agent:', navigator.userAgent);
console.log('Platform:', navigator.platform);
console.log('Screen:', screen.width, 'x', screen.height);

//user context
let USER_CTX = null;


// ---------------- Panchayat Context ----------------

const params = new URLSearchParams(window.location.search);
const PANCHAYAT_ID = params.get('panchayatId');

// If dashboard opened without selecting panchayat
if (!PANCHAYAT_ID) {
  window.location.href = '/select-location.html';
}


// Test the API immediately
async function testAPIConnection() {
    try {
        console.log('Testing API connection to:', API_BASE + '/health');
        const response = await authFetch('/health');
        const data = await response.json();
        console.log('API Test Success:', data);
        return true;
    } catch (error) {
        console.error('API Test Failed:', error);
        return false;
    }
}

// SINGLE DOMContentLoaded listener
// SINGLE DOMContentLoaded listener - FIXED
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Dashboard loading...');

  // 🔐 STEP A — load user context
  try {
    console.log('Fetching user info from /api/me');
    const meRes = await authFetch('/me');
    
    if (!meRes) {
      console.error('Failed to fetch user info - redirecting to login');
      return;
    }
    
    USER_CTX = await meRes.json();
    console.log('User context loaded:', USER_CTX);
    
    // 🔒 STEP B — lock UI for non-panchayat admins
    if (USER_CTX.role !== 'panchayat_admin') {
      console.log('User is not panchayat admin, hiding edit buttons');
      hideAddEditDeleteButtons();
    } else {
      console.log('User is panchayat admin, showing all buttons');
    }

    // 🔗 STEP C — test API AFTER auth is confirmed
    const apiConnected = await testAPIConnection();

    if (apiConnected) {
      console.log('API connected, loading data...');
      loadDashboard();
      loadAllVillagers();
      loadAllSensors();
      loadSensorsForStatus();

      setInterval(() => {
        loadDashboard();
        loadAllSensors();
        loadSensorsForStatus();
      }, 5000);
    }
  } catch (error) {
    console.error('Error loading user context:', error);
    showToast('Failed to load user information', 'danger');
  }
});


        // Section navigation
        function showSection(event, section) {
          document.getElementById('dashboardSection').style.display = 'none';
          document.getElementById('villagersSection').style.display = 'none';
          document.getElementById('sensorsSection').style.display = 'none';
      
          document.getElementById(section + 'Section').style.display = 'block';
      
          document.querySelectorAll('.sidebar .nav-link').forEach(link => {
              link.classList.remove('active');
          });
      
          event.currentTarget.classList.add('active');
      }
      
        // Load dashboard data
        // Load dashboard data - DEBUG VERSION
async function loadDashboard() {
    try {
        console.log('=== loadDashboard called ===');
        console.log('PANCHAYAT_ID:', PANCHAYAT_ID);
        
        const apiUrl = `/admin/dashboard?panchayatId=${PANCHAYAT_ID}`;
        console.log('Fetching dashboard from:', apiUrl);
        
        const response = await authFetch(apiUrl);
        
        if (!response) {
            console.error('No response from dashboard API');
            return;
        }
        
        console.log('Dashboard response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Dashboard HTTP error:', errorText);
            return;
        }
        
        const data = await response.json();
        console.log('Dashboard data:', data);

        if (data.success) {
            const stats = data.data.statistics;
            console.log('Statistics:', stats);
            
            document.getElementById('totalVillagers').textContent = stats.totalVillagers || 0;
            document.getElementById('totalSensors').textContent = stats.totalSensors || 0;
            document.getElementById('totalVillages').textContent = stats.totalVillages || 0;
            document.getElementById('activeAlerts').textContent = stats.activeAlerts || 0;

            updateRecentVillagers(data.data.recentVillagers || []);
        } else {
            console.error('Dashboard API error:', data.error);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}


        //hide add and delete
        function hideAddEditDeleteButtons() {

          // Quick action buttons
          document.querySelectorAll(
            'button[onclick*="Add"], button[onclick*="Edit"], button[onclick*="Delete"]'
          ).forEach(btn => btn.style.display = 'none');
        
          // Villagers table actions
          document.querySelectorAll('#allVillagersTable button')
            .forEach(btn => btn.style.display = 'none');
        
          // Sensors table actions
          document.querySelectorAll('#allSensorsTable button')
            .forEach(btn => btn.style.display = 'none');
        }
        

        // Load all villagers for management section
        // Load all villagers for management section - ENHANCED
// Load all villagers for management section - DEBUG VERSION
// Load all villagers - ENHANCED DEBUG
async function loadAllVillagers() {
    try {
        console.log('=== loadAllVillagers called ===');
        console.log('PANCHAYAT_ID:', PANCHAYAT_ID);
        console.log('USER_CTX:', USER_CTX);
        
        const apiUrl = `/villagers?panchayatId=${PANCHAYAT_ID}`;
        console.log('Fetching:', apiUrl);
        
        const response = await authFetch(apiUrl);
        
        if (!response) {
            console.error('❌ No response (auth issue)');
            return;
        }
        
        console.log('Response OK:', response.ok);
        
        const data = await response.json();
        console.log('📊 FULL API RESPONSE:', JSON.stringify(data, null, 2));
        
        if (data.success) {
            console.log(`✅ Found ${data.villagers.length} villagers`);
            console.log('First villager:', data.villagers[0]);
            
            if (data.villagers.length > 0) {
                updateVillagersTable(data.villagers);
            } else {
                console.log('⚠️ No villagers in array');
                updateVillagersTable([]);
            }
        } else {
            console.error('❌ API error:', data.error);
        }
    } catch (error) {
        console.error('❌ Catch error:', error);
    }
}
        // Load all sensors for management section
       // Load all sensors for management section - FIXED
async function loadAllSensors() {
    try {
        console.log('=== loadAllSensors called ===');
        console.log('PANCHAYAT_ID:', PANCHAYAT_ID);
        
        const apiUrl = `/sensors?panchayatId=${PANCHAYAT_ID}`;
        console.log('Fetching sensors from:', apiUrl);
        
        const response = await authFetch(apiUrl);
        
        if (!response) {
            console.error('❌ No response from sensors API');
            return;
        }
        
        console.log('Sensors response status:', response.status);
        
        const data = await response.json();
        console.log('📊 Sensors API response:', data);
        
        if (data.success) {
            console.log(`✅ Found ${data.sensors.length} sensors`);
            updateSensorsTable(data.sensors || []);
        } else {
            console.error('❌ Sensors API error:', data.error);
            showToast('Failed to load sensors: ' + data.error, 'danger');
        }
    } catch (error) {
        console.error('❌ Error loading sensors:', error);
        showToast('Failed to load sensors', 'danger');
    }
}

        // Load sensors for status table
        // Load sensors for status table - FIXED
async function loadSensorsForStatus() {
    try {
        console.log('Loading sensor status...');
        const response = await authFetch(`/sensors?panchayatId=${PANCHAYAT_ID}`);
        
        if (!response) return;
        
        const data = await response.json();

        if (data.success) {
            console.log('Updating sensor status table with', data.sensors.length, 'sensors');
            updateSensorStatusTable(data.sensors || []);
        }
    } catch (error) {
        console.error('Error loading sensor status:', error);
    }
}
        // Update recent villagers table - FIXED
        function updateRecentVillagers(villagers) {
            const tbody = document.getElementById('recentVillagersTable');
            tbody.innerHTML = '';

            if (villagers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center">No villagers found</td></tr>';
                return;
            }

            villagers.slice(0, 5).forEach(villager => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${villager.name || 'N/A'}</td>
                    <td>${villager.aadhaar_number || 'N/A'}</td>
                    <td>${villager.village || 'N/A'}</td>
                    <td>${villager.phone || 'N/A'}</td>
                `;
                tbody.appendChild(row);
            });
        }

        // Update sensor status table
        // Update sensor status table - FIXED
function updateSensorStatusTable(sensors) {
  const tbody = document.getElementById('sensorStatusTable');
  tbody.innerHTML = '';

  if (sensors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No sensors found</td></tr>';
    return;
  }

  // Take only first 5 sensors for dashboard
  sensors.slice(0, 5).forEach(sensor => {
    const badgeClass = sensor.status === 'Live' ? 'bg-success' : 'bg-secondary';
    
    // Format measurement for display
    let measurementDisplay = 'No data';
    if (sensor.measurement && sensor.measurement !== 'No data') {
      try {
        if (typeof sensor.measurement === 'string' && sensor.measurement.startsWith('{')) {
          const parsed = JSON.parse(sensor.measurement);
          measurementDisplay = `${parsed._field || 'value'}: ${parsed._value}`;
        } else {
          measurementDisplay = sensor.measurement;
        }
      } catch (e) {
        measurementDisplay = sensor.measurement;
      }
    }

    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${sensor.name || 'N/A'}</td>
      <td>${sensor.village || '—'}</td>
      <td><span class="badge ${badgeClass}">${sensor.status}</span></td>
      <td>${measurementDisplay}</td>
    `;
    
    tbody.appendChild(row);
  });
}
          

        // Update villagers management table
        // Update villagers management table - ENHANCED
function updateVillagersTable(villagers) {
    const tbody = document.getElementById('allVillagersTable');
    console.log('Updating table with', villagers.length, 'villagers');
    console.log('Villagers data:', villagers);
    
    tbody.innerHTML = '';

    if (villagers.length === 0) {
        console.log('No villagers to display');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No villagers found</td></tr>';
        return;
    }

    villagers.forEach((villager, index) => {
        console.log(`Processing villager ${index + 1}:`, villager);
        
        const row = document.createElement('tr');
        row.setAttribute('data-id', villager.id);
        row.setAttribute('data-aadhaar', villager.aadhaar_number);
        row.innerHTML = `
            <td>${villager.id || 'N/A'}</td>
            <td>${villager.name || 'N/A'}</td>
            <td>${villager.aadhaar_number || 'N/A'}</td>
            <td>${villager.phone || 'N/A'}</td>
            <td>${villager.village || 'N/A'}</td>
            <td>${villager.panchayat || 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-2" onclick="editVillager('${villager.aadhaar_number}')">
                    <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteVillager('${villager.aadhaar_number}')">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </td>
        `;
        row.style.cursor = 'pointer';

        row.addEventListener('click', (e) => {
          if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
          openVillagerSensors(villager.aadhaar_number);
        });

        tbody.appendChild(row);
    });
    
    console.log('Table updated with', villagers.length, 'rows');
}

        //to see sensor that belong to particular villager
        //to see sensor that belong to particular villager - UPDATED
async function openVillagerSensors(aadhaar) {
  try {
    const res = await authFetch(`/villagers/${aadhaar}/sensors`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (!data.success) {
      showToast('Failed to load sensors: ' + data.error, 'danger');
      return;
    }
    
    // Villager info
    document.getElementById('villagerSensorInfo').innerHTML = `
      <b>Name:</b> ${data.villager.name}<br>
      <b>Aadhaar:</b> ${data.villager.aadhaar}<br>
      <b>Phone:</b> ${data.villager.phone}<br>
      <b>Village:</b> ${data.villager.village}
    `;
    
    const tbody = document.getElementById('villagerSensorsTable');
    tbody.innerHTML = '';
    
    if (data.sensors.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">No sensors mapped</td></tr>`;
    }
    
    data.sensors.forEach(s => {
      const badge = s.status === 'Live'
        ? 'bg-success'
        : 'bg-secondary';
      
      // Fetch latest data for each sensor
      (async () => {
        try {
          const flux = `
            from(bucket: "${INFLUX_CONFIG.bucket}")
              |> range(start: -1h)
              |> filter(fn: (r) => r._measurement == "sensor_data")
              |> filter(fn: (r) => r.devEUI == "${s.devEUI}")
              |> sort(columns: ["_time"], desc: true)
              |> limit(n: 1)
          `;
          
          // Note: You'll need to expose INFLUX_CONFIG from server or create an endpoint
          // For now, just show status
          tbody.innerHTML += `
            <tr>
              <td>${s.devEUI}</td>
              <td>${s.name}</td>
              <td><span class="badge ${badge}">${s.status}</span></td>
              <td>${s.measurement || 'No data'}</td>
              <td>${s.time || 'N/A'}</td>
            </tr>
          `;
        } catch (err) {
          console.error('Error fetching sensor data:', err);
        }
      })();
    });
    
    new bootstrap.Modal(
      document.getElementById('villagerSensorsModal')
    ).show();
    
  } catch (err) {
    console.error('Open villager sensors error:', err);
    showToast('Error loading villager sensors: ' + err.message, 'danger');
  }
}

//Update Sensor - UPDATED
//Update Sensor - FIXED
async function updateSensor() {
  const devEUI = document.getElementById('editDevEUI').value;
  
  const payload = {
    deviceName: document.getElementById('editDeviceName').value,
    village: document.getElementById('editVillage').value,
    panchayat: document.getElementById('editPanchayat').value,
    phone: document.getElementById('editSensorPhone').value || ''
  };
  
  console.log('Updating sensor:', devEUI, payload);

  try {
    const res = await authFetch(`/sensors/${devEUI}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res) {
      showToast('Failed to update sensor', 'danger');
      return;
    }
    
    const result = await res.json();
    
    if (result.success) {
      showToast('✅ Sensor updated successfully', 'success');
      
      // Hide modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('editSensorModal'));
      modal.hide();
      
      // Refresh data
      loadAllSensors();
      loadSensorsForStatus();
      loadDashboard();
      
    } else {
      showToast('❌ ' + result.error, 'danger');
    }
    
  } catch (err) {
    console.error('Update sensor error:', err);
    showToast('⚠️ Update failed: ' + err.message, 'warning');
  }
}

        // Update sensors management table
        // Update sensors management table - FIXED
function updateSensorsTable(sensors) {
  const tbody = document.getElementById('allSensorsTable');
  console.log('Updating sensors table with', sensors.length, 'sensors');
  
  tbody.innerHTML = '';

  if (sensors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No sensors found</td></tr>';
    return;
  }

  sensors.forEach(sensor => {
    console.log('Processing sensor:', sensor);
    
    // Format the measurement display
    let measurementDisplay = 'No data';
    let timeDisplay = '';
    
    if (sensor.measurement && sensor.measurement !== 'No data') {
      try {
        // Try to parse JSON measurement
        if (typeof sensor.measurement === 'string' && sensor.measurement.startsWith('{')) {
          const parsed = JSON.parse(sensor.measurement);
          measurementDisplay = `${parsed._field || 'value'}: ${parsed._value}`;
        } else {
          measurementDisplay = sensor.measurement;
        }
      } catch (e) {
        measurementDisplay = sensor.measurement;
      }
    }
    
    if (sensor.time) {
      timeDisplay = sensor.time;
    }

    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${sensor.devEUI || 'N/A'}</td>
      <td>${sensor.name || 'N/A'}</td>
      <td>
        <div>${measurementDisplay}</div>
        <small class="text-muted">${timeDisplay}</small>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-2"
          onclick="editSensor('${sensor.devEUI}')">Edit</button>
        <button class="btn btn-sm btn-outline-danger"
          onclick="deleteSensor('${sensor.devEUI}')">Delete</button>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  console.log('Sensors table updated with', sensors.length, 'rows');
}

        async function deleteSensor(devEUI) {
  if (!confirm(`Are you sure you want to delete sensor ${devEUI}?`)) {
    return;
  }
  
  console.log('Deleting sensor:', devEUI);

  try {
    const response = await authFetch(`/sensors/${devEUI}`, {
      method: 'DELETE'
    });
    
    if (!response) {
      showToast('Failed to delete sensor', 'danger');
      return;
    }
    
    const result = await response.json();
    console.log('Delete response:', result);

    if (result.success) {
      showToast('✅ Sensor deleted successfully', 'success');
      
      // Refresh sensor tables
      loadAllSensors();
      loadSensorsForStatus();
      loadDashboard();
      
    } else {
      showToast('❌ ' + result.error, 'danger');
    }
    
  } catch (error) {
    console.error('Delete sensor error:', error);
    showToast('⚠️ Failed to delete sensor', 'warning');
  }
}
          
        
          

        // Modal functions
        function showAddVillagerModal() {
            const modal = new bootstrap.Modal(document.getElementById('addVillagerModal'));
            modal.show();
        }

        function showAddSensorModal() {
          const form = document.getElementById('sensorForm');
          form.reset();
        
          // ensure devEUI is enabled
          form.querySelector('[name="devEUI"]').disabled = false;
        
          const title = document.querySelector('#addSensorModal .modal-title');
          if (title) title.textContent = 'Add New Sensor';
        
          new bootstrap.Modal(
            document.getElementById('addSensorModal')
          ).show();
        }        

        //Edit Sensor
       
//Edit Sensor - UPDATED
//Edit Sensor - FIXED
async function editSensor(devEUI) {
  try {
    console.log(`Editing sensor: ${devEUI}`);
    const res = await authFetch(`/sensors/${devEUI}`);
    
    if (!res) {
      showToast('Failed to load sensor', 'danger');
      return;
    }
    
    const data = await res.json();
    console.log('Sensor data received:', data);
    
    if (!data.success) {
      showToast('Failed to load sensor: ' + data.error, 'danger');
      return;
    }
    
    const s = data.sensor;
    console.log('Sensor object:', s);

    // Fill the edit form
    document.getElementById('editDevEUI').value = s.devEUI || '';
    document.getElementById('editDeviceName').value = s.name || '';
    document.getElementById('editVillage').value = s.village || '';
    document.getElementById('editPanchayat').value = s.panchayat || '';
    document.getElementById('editSensorPhone').value = s.phone || '';

    // Show the modal
    new bootstrap.Modal(
      document.getElementById('editSensorModal')
    ).show();
    
  } catch (err) {
    console.error('Edit sensor error:', err);
    showToast('Error loading sensor: ' + err.message, 'danger');
  }
}
        
        //Update Sensor
        // Update sensors management table - FIXED VERSION
        // Update sensors management table - FIXED VERSION
function updateSensorsTable(sensors) {
  const tbody = document.getElementById('allSensorsTable');
  tbody.innerHTML = '';

  if (sensors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No sensors found</td></tr>';
    return;
  }

  sensors.forEach(sensor => {
    const row = document.createElement('tr');

    // Format measurement display
    let measurementDisplay = 'No data';
    if (sensor.measurement && sensor.measurement !== 'No data') {
      try {
        const data = JSON.parse(sensor.measurement);
        measurementDisplay = `${data._field || 'value'}: ${data._value}`;
      } catch (e) {
        measurementDisplay = sensor.measurement;
      }
    }

    row.innerHTML = `
      <td>${sensor.devEUI}</td>
      <td>${sensor.name}</td>
      <td>
        <div>${measurementDisplay}</div>
        <small class="text-muted">${sensor.time || ''}</small>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary"
          onclick="editSensor('${sensor.devEUI}')">Edit</button>
        <button class="btn btn-sm btn-outline-danger"
          onclick="deleteSensor('${sensor.devEUI}')">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}
        // Save villager
        async function saveVillager() {
            const form = document.getElementById('villagerForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            console.log('📤 Saving villager data:', data);

            try {
                const response = await authFetch(`/villagers`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                console.log('✅ Server response:', result);

                if (result.success) {
                    showToast('✅ Villager added successfully!', 'success');
                    bootstrap.Modal.getInstance(document.getElementById('addVillagerModal')).hide();
                    form.reset();

                    setTimeout(() => {
                        loadDashboard();
                        loadAllVillagers();
                    }, 1000);

                } else {
                    showToast('❌ Error: ' + (result.error || 'Unknown error'), 'danger');
                }

            } catch (error) {
                console.error('❌ Save error:', error);
                showToast('⚠️ Failed to add villager. Please try again.', 'warning');
            }
        }

        // Edit villager function
async function editVillager(aadhaarNumber) {
  try {
    console.log(`📝 Editing villager with Aadhaar: ${aadhaarNumber}`);

    const response = await authFetch(`/villagers/${aadhaarNumber}`);
    const data = await response.json();

    console.log('Edit API response:', data);

    if (data.success) {
      const villager = data.villager;
      console.log('Villager data:', villager);

      // Populate the edit form
      document.getElementById('editAadhaarNumber').value = villager.aadhaar_number;
      document.getElementById('editAadhaarDisplay').value = villager.aadhaar_number;
      document.getElementById('editName').value = villager.name || '';
      document.getElementById('editPhone').value = villager.phone || '';
      document.getElementById('editVillage').value = villager.village || '';
      document.getElementById('editPanchayat').value = villager.panchayat || '';
      document.getElementById('editOccupation').value = villager.occupation || '';
      document.getElementById('editAddress').value = villager.address || '';

      // Show the modal
      const modal = new bootstrap.Modal(document.getElementById('editVillagerModal'));
      modal.show();
    } else {
      showToast('❌ Error loading villager: ' + data.error, 'danger');
    }
  } catch (error) {
    console.error('❌ Error in editVillager:', error);
    showToast('⚠️ Failed to load villager data', 'warning');
  }
}

// Update villager function - FIXED
async function updateVillager() {
  try {
    const aadhaarNumber = document.getElementById('editAadhaarNumber').value;

    // Get all form values
    const updateData = {
      name: document.getElementById('editName').value || '',
      phone: document.getElementById('editPhone').value || '',
      village: document.getElementById('editVillage').value || '',
      panchayat: document.getElementById('editPanchayat').value || '',
      address: document.getElementById('editAddress').value || '',
      occupation: document.getElementById('editOccupation').value || ''
    };

    console.log('📤 Updating villager:', aadhaarNumber, updateData);

    // Make PUT request
    const response = await authFetch(`/villagers/${aadhaarNumber}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const result = await response.json();
    console.log('✅ Update response:', result);

    if (result.success) {
      showToast('✅ Villager updated successfully!', 'success');

      // Hide modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('editVillagerModal'));
      modal.hide();

      // Refresh data
      setTimeout(() => {
        loadDashboard();
        loadAllVillagers();
      }, 500);

    } else {
      showToast('❌ Error: ' + (result.error || 'Update failed'), 'danger');
    }

  } catch (error) {
    console.error('❌ Update error:', error);
    showToast('⚠️ Failed to update villager. Please try again.', 'warning');
  }
}

        // Delete villager function
async function deleteVillager(aadhaarNumber) {
  if (!confirm('Are you sure you want to delete this villager? This action cannot be undone.')) {
    return;
  }

  try {
    console.log(`🗑️ Deleting villager with Aadhaar: ${aadhaarNumber}`);

    const response = await authFetch(`/villagers/${aadhaarNumber}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      showToast('✅ Villager deleted successfully!', 'success');

      // Immediately remove the row from the table
      const rows = document.querySelectorAll('#allVillagersTable tr');
      rows.forEach(row => {
        if (row.getAttribute('data-aadhaar') === aadhaarNumber) {
          row.style.transition = 'all 0.3s';
          row.style.opacity = '0';
          row.style.height = '0';
          row.style.overflow = 'hidden';
          setTimeout(() => row.remove(), 300);
        }
      });

      // Update dashboard counts
      loadDashboard();

    } else {
      showToast('❌ Error: ' + (result.error || 'Delete failed'), 'danger');
    }

  } catch (error) {
    console.error('❌ Delete error:', error);
    showToast('⚠️ Failed to delete villager. Please try again.', 'warning');
  }
}

        // Save sensor
        // Save sensor - FIXED
async function saveSensor() {
  const form = document.getElementById('sensorForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  
  console.log('📤 Saving sensor data:', data);
  console.log('Panchayat ID from URL:', PANCHAYAT_ID);

  if (!data.devEUI || !data.deviceName) {
    showToast('DevEUI and Device Name are required', 'danger');
    return;
  }

  try {
    // Add panchayat field if missing
    if (!data.panchayat) {
      data.panchayat = 'D1B1G1'; // Default or get from context
    }
    
    const response = await authFetch(`/sensors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    });

    console.log('Sensor save response status:', response.status);
    const result = await response.json();
    console.log('✅ Sensor save response:', result);

    if (result.success) {
      showToast('✅ Sensor added successfully!', 'success');
      
      // Hide modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('addSensorModal'));
      modal.hide();
      form.reset();

      // Refresh data
      setTimeout(() => {
        loadAllSensors();
        loadSensorsForStatus();
        loadDashboard();
      }, 1000);

    } else {
      showToast('❌ Error: ' + (result.error || 'Failed to add sensor'), 'danger');
    }

  } catch (error) {
    console.error('❌ Save sensor error:', error);
    showToast('⚠️ Failed to add sensor. Please try again.', 'warning');
  }
}
        
        // Utility functions
        function refreshDashboard() {
            loadDashboard();
            showToast('Dashboard data refreshed', 'info');
        }

        function generateReport() {
            showToast('Report generation feature coming soon!', 'info');
        }

        function showToast(message, type = 'info') {
            const toastContainer = document.querySelector('.toast-container');
            const toastId = 'toast-' + Date.now();

            const toastHtml = `
                <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert">
                    <div class="d-flex">
                        <div class="toast-body">
                            ${message}
                        </div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                    </div>
                </div>
            `;

            toastContainer.innerHTML += toastHtml;
            const toastElement = document.getElementById(toastId);
            const toast = new bootstrap.Toast(toastElement);
            toast.show();

            toastElement.addEventListener('hidden.bs.toast', function () {
                toastElement.remove();
            });
        }

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Add this function to test API endpoints
async function testAPIEndpoints() {
  console.log('🔍 Testing API endpoints...');
  
  const endpoints = [
    `/villagers?panchayatId=${PANCHAYAT_ID}`,
    `/sensors?panchayatId=${PANCHAYAT_ID}`,
    `/admin/dashboard?panchayatId=${PANCHAYAT_ID}`
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await authFetch(endpoint);
      console.log(`${endpoint}: ${response.status} ${response.statusText}`);
      const data = await response.json();
      console.log('Response:', data);
    } catch (error) {
      console.error(`❌ Error with ${endpoint}:`, error);
    }
  }
}

// Call this in DOMContentLoaded if you're having issues:
// testAPIEndpoints();
// Debug function to test API directly
async function testVillagersAPI() {
    console.log('=== Testing Villagers API ===');
    
    const token = localStorage.getItem('token');
    console.log('Token exists:', !!token);
    if (token) console.log('Token first 20 chars:', token.substring(0, 20) + '...');
    
    console.log('PANCHAYAT_ID:', PANCHAYAT_ID);
    console.log('USER_CTX:', USER_CTX);
    
    try {
        // Test without authFetch first
        const response = await fetch(`http://localhost:8181/api/villagers?panchayatId=${PANCHAYAT_ID}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Direct fetch status:', response.status);
        console.log('Direct fetch headers:', response.headers);
        
        const data = await response.json();
        console.log('Direct fetch data:', data);
        
        // Also test the dashboard endpoint
        const dashboardRes = await fetch(`http://localhost:8181/api/admin/dashboard?panchayatId=${PANCHAYAT_ID}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Dashboard status:', dashboardRes.status);
        const dashboardData = await dashboardRes.json();
        console.log('Dashboard data:', dashboardData);
        
    } catch (error) {
        console.error('Test error:', error);
    }
}
// Comprehensive debug function
async function debugEverything() {
  console.log('=== DEBUG EVERYTHING ===');
  
  // 1. Check localStorage
  console.log('1. localStorage token:', localStorage.getItem('token') ? 'Exists' : 'Missing');
  
  // 2. Check URL params
  const params = new URLSearchParams(window.location.search);
  console.log('2. URL params:', Object.fromEntries(params.entries()));
  
  // 3. Check global variables
  console.log('3. PANCHAYAT_ID:', PANCHAYAT_ID);
  console.log('4. USER_CTX:', USER_CTX);
  
  // 4. Test /api/me directly
  console.log('5. Testing /api/me...');
  try {
    const token = localStorage.getItem('token');
    const meRes = await fetch('http://localhost:8181/api/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('/api/me status:', meRes.status);
    if (meRes.ok) {
      const meData = await meRes.json();
      console.log('/api/me data:', meData);
    } else {
      console.error('/api/me failed:', await meRes.text());
    }
  } catch (err) {
    console.error('/api/me error:', err);
  }
  
  // 5. Test /api/villagers directly
  console.log('6. Testing /api/villagers...');
  try {
    const token = localStorage.getItem('token');
    const villagersRes = await fetch(`http://localhost:8181/api/villagers?panchayatId=${PANCHAYAT_ID}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('/api/villagers status:', villagersRes.status);
    if (villagersRes.ok) {
      const villagersData = await villagersRes.json();
      console.log('/api/villagers data:', villagersData);
      console.log('Number of villagers:', villagersData.villagers ? villagersData.villagers.length : 0);
      console.log('First villager:', villagersData.villagers ? villagersData.villagers[0] : null);
    } else {
      console.error('/api/villagers failed:', await villagersRes.text());
    }
  } catch (err) {
    console.error('/api/villagers error:', err);
  }
  
  console.log('=== END DEBUG ===');
}

// Call this from browser console: debugEverything()

// Test sensors function
async function testSensorsDebug() {
  console.log('=== TESTING SENSORS ===');
  
  // 1. Test GET /sensors
  const token = localStorage.getItem('token');
  const sensorsRes = await fetch(`http://localhost:8181/api/sensors?panchayatId=${PANCHAYAT_ID}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('Sensors GET status:', sensorsRes.status);
  const sensorsData = await sensorsRes.json();
  console.log('Sensors data:', sensorsData);
  
  // 2. Check if any sensors exist in database
  console.log('Number of sensors:', sensorsData.sensors ? sensorsData.sensors.length : 0);
  
  if (sensorsData.sensors && sensorsData.sensors.length > 0) {
    console.log('First sensor:', sensorsData.sensors[0]);
    console.log('Sensor measurement:', sensorsData.sensors[0].measurement);
    console.log('Sensor time:', sensorsData.sensors[0].time);
  }
  
  console.log('=== END TEST ===');
}