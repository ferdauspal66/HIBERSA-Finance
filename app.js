// Configuration
const API_URL = 'https://script.google.com/macros/s/AKfycbyHyOpYqijF064OXBXUqLK6AsPqdea9yqfdKXyS2hH4GDa2z2dUViF99j6lE7eZ3uAVew/exec';

let currentUser = null;
let jenisData = { IN: [], OUT: [] };
let subjekData = [];

// Cache for SPA performance
let cachedTransaksi = [];
let cachedDashboard = null;
let lastDashboardFetch = null;
let lastTransaksiFetch = null;
let isEditMode = false;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transaksiTanggal').value = today;
    
    // Set default filter month
    const currentMonth = new Date().toISOString().substring(0, 7);
    document.getElementById('filterMonth').value = currentMonth;

    // Check Remember Me
    const rememberedUser = localStorage.getItem('rememberedUser');
    if (rememberedUser) {
        const userData = JSON.parse(rememberedUser);
        document.getElementById('username').value = userData.username;
        document.getElementById('password').value = userData.password;
        document.getElementById('rememberMe').checked = true;
    }

    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Transaksi form
    document.getElementById('transaksiForm').addEventListener('submit', handleTransaksiSubmit);
    
    // Jenis form
    document.getElementById('jenisForm').addEventListener('submit', handleJenisSubmit);
    
    // Subjek form
    document.getElementById('subjekForm').addEventListener('submit', handleSubjekSubmit);

    // Check if already logged in
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
    }
});

// Login
async function handleLogin(e) {
    e.preventDefault();
    showLoading(true);
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    try {
        const response = await fetch(`${API_URL}?action=login&username=${username}&password=${password}`);
        const result = await response.json();
        
        if (result.success) {
            currentUser = { username };
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Handle Remember Me
            if (rememberMe) {
                localStorage.setItem('rememberedUser', JSON.stringify({ username, password }));
            } else {
                localStorage.removeItem('rememberedUser');
            }
            
            showMainApp();
        } else {
            alert('Login gagal! Username atau password salah.');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Terjadi kesalahan saat login.');
    }
    
    showLoading(false);
}

function logout() {
    sessionStorage.removeItem('currentUser');
    currentUser = null;
    
    // Clear cache
    cachedTransaksi = [];
    cachedDashboard = null;
    lastDashboardFetch = null;
    lastTransaksiFetch = null;
    
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    loadInitialData();
}

// Load initial data
async function loadInitialData() {
    await loadJenisData();
    await loadSubjekData();
    await loadDashboard();
}

// Dashboard
async function loadDashboard(forceRefresh = false) {
    const filterMonth = document.getElementById('filterMonth').value;
    
    // Use cache if available, not forcing refresh, and recent
    const now = Date.now();
    if (!forceRefresh && cachedDashboard && lastDashboardFetch && 
        (now - lastDashboardFetch) < 30000 && cachedDashboard.month === filterMonth) {
        updateDashboardUI(cachedDashboard.data);
        return;
    }
    
    // Show loading indicator (non-blocking)
    showBackgroundLoading('dashboard', true);
    
    try {
        const response = await fetch(`${API_URL}?action=getDashboard&month=${filterMonth}`);
        const result = await response.json();
        
        if (result.success) {
            cachedDashboard = { month: filterMonth, data: result.data };
            lastDashboardFetch = now;
            updateDashboardUI(result.data);
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        alert('Gagal memuat dashboard. Silakan coba lagi.');
    } finally {
        showBackgroundLoading('dashboard', false);
    }
}

function updateDashboardUI(data) {
    document.getElementById('totalPemasukan').textContent = formatRupiah(data.totalPemasukan);
    document.getElementById('totalPengeluaran').textContent = formatRupiah(data.totalPengeluaran);
    document.getElementById('saldo').textContent = formatRupiah(data.saldo);
    
    // Draw simple chart
    drawChart(data.chartData);
}

function drawChart(data) {
    const canvas = document.getElementById('chartCanvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (!data || data.length === 0) {
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('Tidak ada data', width / 2, height / 2);
        return;
    }
    
    // Simple bar chart
    const barWidth = width / data.length - 10;
    const maxValue = Math.max(...data.map(d => Math.max(d.pemasukan, d.pengeluaran)));
    
    data.forEach((item, index) => {
        const x = index * (barWidth + 10) + 5;
        
        // Pemasukan (green)
        const pemasukanHeight = (item.pemasukan / maxValue) * (height - 40);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(x, height - pemasukanHeight - 20, barWidth / 2 - 2, pemasukanHeight);
        
        // Pengeluaran (red)
        const pengeluaranHeight = (item.pengeluaran / maxValue) * (height - 40);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x + barWidth / 2 + 2, height - pengeluaranHeight - 20, barWidth / 2 - 2, pengeluaranHeight);
        
        // Date label
        ctx.fillStyle = '#000';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.date, x + barWidth / 2, height - 5);
    });
}

// Transaksi
async function loadTransaksi(forceRefresh = false) {
    const filterTipe = document.getElementById('filterTipe').value;
    
    // Use cache if available and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && cachedTransaksi.length > 0 && lastTransaksiFetch && (now - lastTransaksiFetch) < 30000) {
        displayTransaksi(cachedTransaksi.filter(t => !filterTipe || t.tipe === filterTipe));
        return;
    }
    
    // Show loading indicator (non-blocking)
    showBackgroundLoading('transaksi', true);
    
    try {
        const response = await fetch(`${API_URL}?action=getTransaksi&tipe=${filterTipe}`);
        const result = await response.json();
        
        if (result.success) {
            cachedTransaksi = result.data;
            lastTransaksiFetch = now;
            displayTransaksi(result.data);
        }
    } catch (error) {
        console.error('Load transaksi error:', error);
        alert('Gagal memuat transaksi. Silakan coba lagi.');
    } finally {
        showBackgroundLoading('transaksi', false);
    }
}

function displayTransaksi(transaksiList) {
    const container = document.getElementById('transaksiList');
    
    if (transaksiList.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">Belum ada transaksi</p>';
        return;
    }
    
    container.innerHTML = transaksiList.map(t => `
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <span class="text-xs text-gray-500">${t.idTransaksi}</span>
                    <p class="font-bold">${t.jenis}</p>
                    <p class="text-sm text-gray-600">${t.subjek}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-500">${formatDate(t.tanggal)}</p>
                    <p class="font-bold ${t.tipe === 'IN' ? 'text-green-600' : 'text-red-600'}">
                        ${t.tipe === 'IN' ? '+' : '-'} ${formatRupiah(t.nominal)}
                    </p>
                </div>
            </div>
            ${t.keterangan ? `<p class="text-sm text-gray-600 mb-2">${t.keterangan}</p>` : ''}
            <div class="flex gap-2 mt-3">
                <button onclick='editTransaksi(${JSON.stringify(t)})' class="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition">
                    <i data-lucide="edit-2" class="w-4 h-4"></i> Edit
                </button>
                <button onclick="deleteTransaksi('${t.idTransaksi}')" class="flex items-center gap-1 px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i> Hapus
                </button>
            </div>
        </div>
    `).join('');
    
    // Re-initialize Lucide icons after DOM update
    setTimeout(() => lucide.createIcons(), 50);
}

function showInputModal() {
    isEditMode = false;
    document.getElementById('transaksiId').value = '';
    document.getElementById('modalTitle').textContent = 'Input Transaksi';
    document.getElementById('inputModal').classList.remove('hidden');
    document.getElementById('inputModal').classList.add('flex');
    loadJenisOptions();
    loadSubjekOptions();
}

function editTransaksi(transaksi) {
    isEditMode = true;
    document.getElementById('transaksiId').value = transaksi.idTransaksi;
    document.getElementById('modalTitle').textContent = 'Edit Transaksi';
    
    // Set form values
    document.getElementById('transaksiType').value = transaksi.tipe;
    document.getElementById('transaksiTanggal').value = transaksi.tanggal;
    document.getElementById('transaksiNominal').value = transaksi.nominal;
    document.getElementById('transaksiKeterangan').value = transaksi.keterangan || '';
    
    // Switch tab
    switchInputTab(transaksi.tipe);
    
    // Load options and set selected values
    loadJenisOptions();
    loadSubjekOptions();
    
    setTimeout(() => {
        document.getElementById('transaksiJenis').value = transaksi.jenis;
        document.getElementById('transaksiSubjek').value = transaksi.subjek;
    }, 100);
    
    // Show modal
    document.getElementById('inputModal').classList.remove('hidden');
    document.getElementById('inputModal').classList.add('flex');
}

async function deleteTransaksi(idTransaksi) {
    if (!confirm('Yakin ingin menghapus transaksi ini?')) return;
    
    showLoading(true);
    
    const data = {
        action: 'deleteTransaksi',
        idTransaksi: idTransaksi
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (result.success) {
            alert('Transaksi berhasil dihapus!');
            clearCache();
            loadDashboard(true);
            loadTransaksi(true);
        } else {
            alert('Gagal menghapus transaksi: ' + result.message);
        }
    } catch (error) {
        console.error('Delete transaksi error:', error);
        alert('Terjadi kesalahan saat menghapus transaksi.');
    }
    
    showLoading(false);
}

function closeInputModal() {
    document.getElementById('inputModal').classList.add('hidden');
    document.getElementById('inputModal').classList.remove('flex');
    document.getElementById('transaksiForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transaksiTanggal').value = today;
    isEditMode = false;
}

function switchInputTab(type) {
    document.getElementById('transaksiType').value = type;
    
    // Update tab styling
    document.getElementById('inputTabIN').className = type === 'IN' 
        ? 'flex-1 py-3 border-b-2 border-black font-bold' 
        : 'flex-1 py-3 text-gray-600 border-b-2 border-transparent';
    document.getElementById('inputTabOUT').className = type === 'OUT' 
        ? 'flex-1 py-3 border-b-2 border-black font-bold' 
        : 'flex-1 py-3 text-gray-600 border-b-2 border-transparent';
    
    loadJenisOptions();
}

async function handleTransaksiSubmit(e) {
    e.preventDefault();
    showLoading(true);
    
    const data = {
        action: isEditMode ? 'updateTransaksi' : 'addTransaksi',
        idTransaksi: document.getElementById('transaksiId').value,
        tipe: document.getElementById('transaksiType').value,
        tanggal: document.getElementById('transaksiTanggal').value,
        jenis: document.getElementById('transaksiJenis').value,
        subjek: document.getElementById('transaksiSubjek').value,
        nominal: document.getElementById('transaksiNominal').value,
        keterangan: document.getElementById('transaksiKeterangan').value
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (result.success) {
            alert(isEditMode ? 'Transaksi berhasil diupdate!' : 'Transaksi berhasil disimpan!');
            closeInputModal();
            clearCache();
            loadDashboard(true);
            if (document.getElementById('transaksiPage').classList.contains('active')) {
                loadTransaksi(true);
            }
        } else {
            alert('Gagal menyimpan transaksi: ' + result.message);
        }
    } catch (error) {
        console.error('Submit transaksi error:', error);
        alert('Terjadi kesalahan saat menyimpan transaksi.');
    }
    
    showLoading(false);
}

// Jenis
async function loadJenisData() {
    try {
        const response = await fetch(`${API_URL}?action=getJenis`);
        const result = await response.json();
        
        if (result.success) {
            jenisData = result.data;
            displayJenis();
        }
    } catch (error) {
        console.error('Load jenis error:', error);
    }
}

function displayJenis() {
    const currentType = document.getElementById('jenisType').value;
    const container = document.getElementById('jenisList');
    const list = jenisData[currentType] || [];
    
    if (list.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">Belum ada jenis transaksi</p>';
        return;
    }
    
    container.innerHTML = list.map(jenis => `
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-3 flex justify-between items-center">
            <span>${jenis}</span>
            <button onclick="deleteJenis('${jenis}')" class="text-red-600 text-sm p-2 hover:bg-red-50 rounded transition">
                <i data-lucide="trash-2" class="w-5 h-5"></i>
            </button>
        </div>
    `).join('');
    
    setTimeout(() => lucide.createIcons(), 50);
}

function switchJenisTab(type) {
    document.getElementById('jenisType').value = type;
    
    // Update tab styling
    document.getElementById('tabIN').className = type === 'IN' 
        ? 'flex-1 py-2 px-4 border-b-2 border-black font-bold' 
        : 'flex-1 py-2 px-4 text-gray-600 border-b-2 border-transparent';
    document.getElementById('tabOUT').className = type === 'OUT' 
        ? 'flex-1 py-2 px-4 border-b-2 border-black font-bold' 
        : 'flex-1 py-2 px-4 text-gray-600 border-b-2 border-transparent';
    
    displayJenis();
}

async function handleJenisSubmit(e) {
    e.preventDefault();
    showLoading(true);
    
    const data = {
        action: 'addJenis',
        tipe: document.getElementById('jenisType').value,
        nama: document.getElementById('jenisNama').value
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('jenisNama').value = '';
            await loadJenisData();
        } else {
            alert('Gagal menambah jenis: ' + result.message);
        }
    } catch (error) {
        console.error('Add jenis error:', error);
        alert('Terjadi kesalahan saat menambah jenis.');
    }
    
    showLoading(false);
}

async function deleteJenis(nama) {
    if (!confirm(`Hapus jenis "${nama}"?`)) return;
    
    showLoading(true);
    
    const data = {
        action: 'deleteJenis',
        tipe: document.getElementById('jenisType').value,
        nama: nama
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (result.success) {
            await loadJenisData();
        } else {
            alert('Gagal menghapus jenis: ' + result.message);
        }
    } catch (error) {
        console.error('Delete jenis error:', error);
        alert('Terjadi kesalahan saat menghapus jenis.');
    }
    
    showLoading(false);
}

function loadJenisOptions() {
    const select = document.getElementById('transaksiJenis');
    const type = document.getElementById('transaksiType').value;
    const list = jenisData[type] || [];
    
    select.innerHTML = '<option value="">Pilih Jenis</option>' + 
        list.map(jenis => `<option value="${jenis}">${jenis}</option>`).join('');
}

// Subjek
async function loadSubjekData() {
    try {
        const response = await fetch(`${API_URL}?action=getSubjek`);
        const result = await response.json();
        
        if (result.success) {
            subjekData = result.data;
            displaySubjek();
        }
    } catch (error) {
        console.error('Load subjek error:', error);
    }
}

function displaySubjek() {
    const container = document.getElementById('subjekList');
    
    if (subjekData.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">Belum ada subjek</p>';
        return;
    }
    
    container.innerHTML = subjekData.map(subjek => `
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-3 flex justify-between items-center">
            <span>${subjek}</span>
            <button onclick="deleteSubjek('${subjek}')" class="text-red-600 text-sm p-2 hover:bg-red-50 rounded transition">
                <i data-lucide="trash-2" class="w-5 h-5"></i>
            </button>
        </div>
    `).join('');
    
    setTimeout(() => lucide.createIcons(), 50);
}

async function handleSubjekSubmit(e) {
    e.preventDefault();
    showLoading(true);
    
    const data = {
        action: 'addSubjek',
        nama: document.getElementById('subjekNama').value
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('subjekNama').value = '';
            await loadSubjekData();
        } else {
            alert('Gagal menambah subjek: ' + result.message);
        }
    } catch (error) {
        console.error('Add subjek error:', error);
        alert('Terjadi kesalahan saat menambah subjek.');
    }
    
    showLoading(false);
}

async function deleteSubjek(nama) {
    if (!confirm(`Hapus subjek "${nama}"?`)) return;
    
    showLoading(true);
    
    const data = {
        action: 'deleteSubjek',
        nama: nama
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (result.success) {
            await loadSubjekData();
        } else {
            alert('Gagal menghapus subjek: ' + result.message);
        }
    } catch (error) {
        console.error('Delete subjek error:', error);
        alert('Terjadi kesalahan saat menghapus subjek.');
    }
    
    showLoading(false);
}

function loadSubjekOptions() {
    const select = document.getElementById('transaksiSubjek');
    
    select.innerHTML = '<option value="">Pilih Subjek</option>' + 
        subjekData.map(subjek => `<option value="${subjek}">${subjek}</option>`).join('');
}

// Navigation
function switchPage(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Remove active from all nav buttons (both mobile and desktop)
    document.querySelectorAll('#bottomNav button, #sideNav button').forEach(btn => {
        btn.classList.remove('active-nav');
        btn.classList.add('text-gray-600');
    });
    
    // Show selected page
    document.getElementById(page + 'Page').classList.add('active');
    
    // Activate nav buttons (both mobile and desktop)
    const pageName = page.charAt(0).toUpperCase() + page.slice(1);
    const navBtn = document.getElementById('nav' + pageName);
    const sideNavBtn = document.getElementById('sideNav' + pageName);
    
    if (navBtn) {
        navBtn.classList.add('active-nav');
        navBtn.classList.remove('text-gray-600');
    }
    if (sideNavBtn) {
        sideNavBtn.classList.add('active-nav');
        sideNavBtn.classList.remove('text-gray-600');
    }
    
    // Load data for page (use cached data for fast SPA experience)
    if (page === 'transaksi') {
        loadTransaksi();
    } else if (page === 'jenis') {
        displayJenis();
    } else if (page === 'akun') {
        displaySubjek();
    }
    
    // Re-initialize Lucide icons
    setTimeout(() => lucide.createIcons(), 50);
}

// Utility functions
function formatRupiah(amount) {
    return 'Rp ' + parseInt(amount).toLocaleString('id-ID');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    } else {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
}

function showBackgroundLoading(section, show) {
    const loadingElement = document.getElementById(section + 'Loading');
    
    if (loadingElement) {
        if (show) {
            loadingElement.classList.add('show');
        } else {
            loadingElement.classList.remove('show');
        }
    }
}

function clearCache() {
    cachedTransaksi = [];
    cachedDashboard = null;
    lastTransaksiFetch = null;
    lastDashboardFetch = null;
}