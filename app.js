const ui = {
    currentTerceroId: null,

    init() {
        lucide.createIcons();
        this.loadTerceros();
        this.loadStats();
        this.loadProgramas();
        this.bindEvents();
    },

    async loadStats() {
        try {
            const stats = await API.get('/stats');
            if (document.getElementById('stat-terceros')) {
                document.getElementById('stat-terceros').innerText = stats.terceros.toLocaleString();
                document.getElementById('stat-programas').innerText = stats.programas.toLocaleString();
                document.getElementById('stat-asignaturas').innerText = stats.asignaturas.toLocaleString();
                document.getElementById('stat-pensums').innerText = stats.pensums.toLocaleString();
            }
        } catch (err) {
            console.error('Error al cargar estadísticas');
        }
    },

    async loadProgramas() {
        const select = document.getElementById('select-programa');
        if (!select) return;
        try {
            const programas = await API.get('/programas');
            select.innerHTML = '<option value="">Seleccione una carrera...</option>' + 
                programas.map(p => `<option value="${p.ID}">${p.NOMBRE}</option>`).join('');
        } catch (err) {
            console.error('Error al cargar programas');
        }
    },

    bindEvents() {
        const form = document.getElementById('form-terceros');
        if (form) form.onsubmit = (e) => this.handleSubmitTercero(e);
        
        // Listener para carga masiva
        const importBtn = document.getElementById('btn-importar');
        if (importBtn) importBtn.onclick = () => this.handleImport();
    },

    async loadTerceros() {
        try {
            const terceros = await API.get('/terceros');
            this.renderTerceros(terceros);
        } catch (err) {
            console.error('Error cargando terceros:', err);
        }
    },

    renderTerceros(terceros) {
        const tbody = document.getElementById('terceros-body');
        if (!tbody) return;
        
        tbody.innerHTML = terceros.map(t => `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td class="py-4 px-4">${t.NOMBRES} ${t.APELLIDOS}</td>
                <td class="py-4 px-4">${t.ID}</td>
                <td class="py-4 px-4 text-zinc-400">${t.CORREO}</td>
                <td class="py-4 px-4"><span class="px-2 py-1 bg-white/5 rounded text-xs">${t.TIPO}</span></td>
                <td class="py-4 px-4 text-right">
                    <button onclick="ui.editTercero('${t.ID}')" class="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="ui.deleteTercero('${t.ID}')" class="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    },

    async handleSubmitTercero(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        try {
            if (this.currentTerceroId) {
                await API.put(`/terceros/${this.currentTerceroId}`, data);
            } else {
                await API.post('/terceros', data);
            }
            this.toggleModal('modal-tercero', false);
            this.loadTerceros();
            this.loadStats();
            e.target.reset();
            this.currentTerceroId = null;
        } catch (err) {
            alert('Error: ' + (err.error || 'No se pudo completar la operación'));
        }
    },

    async deleteTercero(id) {
        if (!confirm('¿Está seguro de eliminar este registro?')) return;
        try {
            await API.delete(`/terceros/${id}`);
            this.loadTerceros();
        } catch (err) {
            alert('Error al eliminar');
        }
    },

    async editTercero(id) {
        this.currentTerceroId = id;
        try {
            // Buscamos el tercero en la lista local o lo pedimos al servidor
            const terceros = await API.get('/terceros');
            const t = terceros.find(item => item.ID === id);
            
            if (t) {
                const form = document.getElementById('form-terceros');
                form.id.value = t.ID;
                form.nombres.value = t.NOMBRES;
                form.apellidos.value = t.APELLIDOS;
                form.correo.value = t.CORREO;
                form.tipo.value = t.TIPO;
                
                this.toggleModal('modal-tercero', true);
            }
        } catch (err) {
            alert('Error al cargar datos para editar');
        }
    },

    // Procesos
    async handleAssignment() {
        const programaId = document.getElementById('prog-select').value;
        const asignaturaId = document.getElementById('asig-select').value;
        
        if (!programaId || !asignaturaId) return alert('Seleccione programa y asignatura');
        
        try {
            const result = await API.post('/procesos/asignar-pensum', { programaId, asignaturaId });
            alert(result.message);
        } catch (err) {
            alert('Error al asignar pensum');
        }
    },

    async generateReport() {
        const id = document.getElementById('student-id').value;
        if (!id) return alert('Ingrese un ID');

        try {
            const data = await API.get(`/reportes/promedio/${id}`);
            
            document.getElementById('res-id').innerText = data.id;
            document.getElementById('res-promedio').innerText = data.promedio;
            document.getElementById('res-fecha').innerText = data.fecha;

            document.getElementById('cert-empty').classList.add('hidden');
            document.getElementById('cert-display').classList.remove('hidden');
        } catch (err) {
            alert('Estudiante no encontrado o sin calificaciones');
        }
    },

    downloadPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const id = document.getElementById('res-id').innerText;
        const promedio = document.getElementById('res-promedio').innerText;
        const fecha = document.getElementById('res-fecha').innerText;

        // Diseño del PDF
        doc.setFillColor(20, 20, 25);
        doc.rect(0, 0, 297, 210, 'F');

        // Bordes
        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(2);
        doc.rect(10, 10, 277, 190);

        // Títulos
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(40);
        doc.text('CERTIFICADO ACADÉMICO', 148, 60, { align: 'center' });

        doc.setFontSize(16);
        doc.setTextColor(16, 185, 129);
        doc.text('INSTITUCIÓN EDUCATIVA ACADEMICOS', 148, 75, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(180, 180, 180);
        doc.text('Por medio de la presente se certifica que el estudiante con ID:', 148, 100, { align: 'center' });
        
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text(id, 148, 115, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(180, 180, 180);
        doc.text('Ha obtenido un promedio acumulado de:', 148, 135, { align: 'center' });

        doc.setFontSize(48);
        doc.setTextColor(16, 185, 129);
        doc.text(promedio, 148, 155, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Expedido el: ${fecha}`, 148, 180, { align: 'center' });
        doc.text('Validado por AcademicOS - Sistema de Gestión de Oracle DB', 148, 185, { align: 'center' });

        doc.save(`Certificado_${id}.pdf`);
    },

    toggleModal(id, show) {
        const modal = document.getElementById(id);
        if (modal) {
            show ? modal.classList.remove('hidden') : modal.classList.add('hidden');
            if (!show) this.currentTerceroId = null;
        }
    },

    // Herramientas: Importar
    async handleImport() {
        const fileInput = document.getElementById('file-import');
        if (!fileInput || !fileInput.files[0]) return alert('Seleccione un archivo CSV');
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        
        try {
            const response = await fetch('http://localhost:3000/api/herramientas/importar', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            if (!response.ok) throw result;
            
            alert(result.message);
        } catch (err) {
            alert('Error en importación: ' + (err.error || err.message || 'Error desconocido'));
        }
    },

    // Herramientas: Exportar
    handleExport() {
        window.location.href = 'http://localhost:3000/api/herramientas/exportar';
    }
};

document.addEventListener('DOMContentLoaded', () => ui.init());