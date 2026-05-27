const ui = {
    currentTerceroId: null,
    estudiantes: [],
    programas: [],
    selectedStudent: null,
    selectedProgram: null,
    selectedPensumId: null,

    init() {
        lucide.createIcons();
        this.loadTerceros();
        this.loadStats();
        this.loadProgramas();
        this.initAsignarPensum();
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
                programas.map(p => `<option value="${p.PROG_ID || p.ID}">${p.PROG_PROGRAMA || p.NOMBRE}</option>`).join('');
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

    async initAsignarPensum() {
        if (!document.getElementById('form-asignar-pensum')) return;

        this.bindAsignarPensumEvents();

        try {
            await Promise.all([
                this.loadEstudiantesPensum(),
                this.loadProgramasPensum()
            ]);
            this.showAsignarStatus('', 'info', true);
        } catch (err) {
            this.showAsignarStatus('No fue posible conectar con la API. Verifique que el backend este activo.', 'error');
        }
    },

    bindAsignarPensumEvents() {
        const searchInput = document.getElementById('student-search');
        const studentSelect = document.getElementById('student-select');
        const programSelect = document.getElementById('program-select');
        const pensumSelect = document.getElementById('pensum-select');
        const assignBtn = document.getElementById('btn-asignar-pensum');
        const examineBtn = document.getElementById('btn-examinar-pensum');

        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderStudentOptions(searchInput.value));
        }

        if (studentSelect) {
            studentSelect.addEventListener('change', () => {
                this.selectedStudent = this.estudiantes.find(e => String(e.TERC_ID) === studentSelect.value) || null;
            });
        }

        if (programSelect) {
            programSelect.addEventListener('change', async () => {
                this.selectedProgram = this.programas.find(p => String(p.PROG_ID) === programSelect.value) || null;
                this.selectedPensumId = null;
                await this.loadPensumsByProgram(programSelect.value);
            });
        }

        if (pensumSelect) {
            pensumSelect.addEventListener('change', () => {
                this.selectedPensumId = pensumSelect.value || null;
            });
        }

        if (assignBtn) assignBtn.addEventListener('click', () => this.assignPensumToStudent());
        if (examineBtn) examineBtn.addEventListener('click', () => this.examineStudentPensum());
    },

    async loadEstudiantesPensum() {
        this.estudiantes = await API.get('/estudiantes');
        this.renderStudentOptions('');
    },

    renderStudentOptions(query) {
        const select = document.getElementById('student-select');
        if (!select) return;

        const normalizedQuery = String(query || '').trim().toLowerCase();
        const filtered = this.estudiantes.filter((student) => {
            const fullText = `${student.TERC_ID} ${student.TERC_NOMBRES} ${student.TERC_APELLIDOS}`.toLowerCase();
            return fullText.includes(normalizedQuery);
        });

        select.innerHTML = '<option value="">Seleccione un estudiante...</option>' +
            filtered.map(student => `
                <option value="${student.TERC_ID}">
                    ${student.TERC_ID} - ${student.TERC_NOMBRES} ${student.TERC_APELLIDOS}
                </option>
            `).join('');

        if (!filtered.length) {
            select.innerHTML = '<option value="">Sin estudiantes para la busqueda...</option>';
        }
    },

    async loadProgramasPensum() {
        const select = document.getElementById('program-select');
        if (!select) return;

        this.programas = await API.get('/programas');
        select.innerHTML = '<option value="">Seleccione un programa...</option>' +
            this.programas.map(programa => `
                <option value="${programa.PROG_ID}">${programa.PROG_PROGRAMA}</option>
            `).join('');
    },

    async loadPensumsByProgram(programId) {
        const select = document.getElementById('pensum-select');
        if (!select) return;

        if (!programId) {
            select.disabled = true;
            select.innerHTML = '<option value="">Seleccione primero un programa...</option>';
            return;
        }

        try {
            select.disabled = true;
            select.innerHTML = '<option value="">Cargando pensums...</option>';
            const pensums = await API.get(`/pensums/${programId}`);

            select.innerHTML = '<option value="">Seleccione un pensum...</option>' +
                pensums.map(pensum => {
                    const label = pensum.PENS_PERIODO || pensum.PENS_NOMBRE || pensum.PENS_DESCRIPCION || `Pensum ${pensum.PENS_ID}`;
                    return `<option value="${pensum.PENS_ID}">${label}</option>`;
                }).join('');
            select.disabled = !pensums.length;

            if (!pensums.length) {
                select.innerHTML = '<option value="">Este programa no tiene pensums...</option>';
            }
        } catch (err) {
            select.disabled = true;
            select.innerHTML = '<option value="">Error cargando pensums...</option>';
            this.showAsignarStatus('No se pudieron cargar los pensums del programa seleccionado.', 'error');
        }
    },

    async assignPensumToStudent() {
        const tercId = document.getElementById('student-select')?.value;
        const pensId = document.getElementById('pensum-select')?.value;

        if (!tercId || !pensId) {
            this.showAsignarStatus('Seleccione estudiante, programa y pensum antes de asignar.', 'error');
            return;
        }

        try {
            await API.post('/asignar-pensum', {
                terc_id: Number(tercId),
                pens_id: Number(pensId)
            });
            alert('Pensum asignado correctamente.');
            this.showAsignarStatus('Pensum asignado correctamente.', 'success');
        } catch (err) {
            this.showAsignarStatus('Error al asignar pensum: ' + (err.error || err.message || 'Operacion no completada'), 'error');
        }
    },

    async examineStudentPensum() {
        const tercId = document.getElementById('student-select')?.value;
        if (!tercId) {
            this.showAsignarStatus('Seleccione un estudiante para examinar.', 'error');
            return;
        }

        this.selectedStudent = this.estudiantes.find(e => String(e.TERC_ID) === tercId) || null;
        this.renderStudentSummary();

        try {
            const historial = await API.get(`/historial/${tercId}`);
            this.renderHistorial(historial);
            this.showAsignarStatus('', 'info', true);
        } catch (err) {
            this.renderHistorial([]);
            this.showAsignarStatus('No se pudo consultar el historial del estudiante.', 'error');
        }
    },

    renderStudentSummary() {
        const summary = document.getElementById('student-summary');
        if (!summary || !this.selectedStudent) return;

        document.getElementById('summary-nombres').innerText = this.selectedStudent.TERC_NOMBRES || '--';
        document.getElementById('summary-apellidos').innerText = this.selectedStudent.TERC_APELLIDOS || '--';
        document.getElementById('summary-programa').innerText = this.selectedProgram?.PROG_PROGRAMA || '--';
        summary.classList.remove('hidden');
    },

    renderHistorial(historial) {
        const tbody = document.getElementById('historial-body');
        if (!tbody) return;

        if (!historial.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-zinc-500">No hay materias matriculadas para este estudiante.</td></tr>';
            return;
        }

        tbody.innerHTML = historial.map(item => `
            <tr class="hover:bg-white/[0.02] transition-colors">
                <td class="font-mono text-zinc-300">${item.CURS_ID}</td>
                <td class="font-semibold text-white">${item.ASIG_ASIGNATURA}</td>
                <td class="text-zinc-300">${item.HIST_NOTA ?? 'Pendiente'}</td>
            </tr>
        `).join('');
    },

    showAsignarStatus(message, type = 'info', hide = false) {
        const status = document.getElementById('asignar-status');
        if (!status) return;

        if (hide || !message) {
            status.classList.add('hidden');
            status.innerText = '';
            return;
        }

        const styles = {
            success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
            error: 'border-red-500/30 bg-red-500/10 text-red-200',
            info: 'border-white/10 bg-white/5 text-zinc-300'
        };

        status.className = `rounded-lg border px-4 py-3 text-sm ${styles[type] || styles.info}`;
        status.innerText = message;
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
        
        tbody.innerHTML = terceros.map(t => {
            let badgeClass = 'badge badge-admin';
            if (t.TIPO === 'Estudiante') badgeClass = 'badge badge-student';
            else if (t.TIPO === 'Docente') badgeClass = 'badge badge-teacher';
            
            return `
                <tr class="hover:bg-white/[0.02] transition-colors">
                    <td class="py-4 px-4 font-semibold text-white">${t.NOMBRES} ${t.APELLIDOS}</td>
                    <td class="py-4 px-4 font-mono text-zinc-300 text-sm">${t.ID}</td>
                    <td class="py-4 px-4 text-zinc-400 text-sm">${t.CORREO}</td>
                    <td class="py-4 px-4"><span class="${badgeClass}">${t.TIPO}</span></td>
                    <td class="py-4 px-4 text-right">
                        <div class="inline-flex gap-1">
                            <button onclick="ui.editTercero('${t.ID}')" class="p-2 text-primary hover:bg-primary/10 rounded-xl border border-transparent hover:border-primary/20 transition-all active:scale-90" title="Editar">
                                <i data-lucide="edit-2" class="w-4 h-4"></i>
                            </button>
                            <button onclick="ui.deleteTercero('${t.ID}')" class="p-2 text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition-all active:scale-90" title="Eliminar">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    },

    openNewTercero() {
        const form = document.getElementById('form-terceros');
        if (form) form.reset();
        this.currentTerceroId = null;
        this.toggleModal('modal-tercero', true);
    },

    validateTerceroForm(data) {
        const requiredFields = {
            tipo_doc: 'Tipo de documento',
            nro_doc: 'Numero de documento',
            genero: 'Genero',
            nombres: 'Nombres',
            apellidos: 'Apellidos',
            direc: 'Direccion',
            correo: 'Correo',
            movil: 'Movil',
            tipo: 'Tipo'
        };

        const missing = Object.entries(requiredFields)
            .filter(([field]) => !String(data[field] || '').trim())
            .map(([, label]) => label);

        if (missing.length) {
            alert('Faltan campos obligatorios: ' + missing.join(', '));
            return false;
        }

        return true;
    },

    async handleSubmitTercero(e) {
        e.preventDefault();
        if (!e.target.checkValidity()) {
            e.target.reportValidity();
            return;
        }

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.id = data.nro_doc;

        if (!this.validateTerceroForm(data)) return;
        
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
                if (form.tipo_doc) form.tipo_doc.value = t.TIPO_DOC || '';
                form.nro_doc.value = t.NRO_DOC || t.ID;
                if (form.genero) form.genero.value = t.GENERO || '';
                form.nombres.value = t.NOMBRES;
                form.apellidos.value = t.APELLIDOS;
                if (form.direc) form.direc.value = t.DIREC || '';
                form.correo.value = t.CORREO;
                if (form.movil) form.movil.value = t.MOVIL || '';
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
            if (show) {
                modal.classList.remove('hidden');
                setTimeout(() => modal.classList.add('active'), 10);
            } else {
                modal.classList.remove('active');
                setTimeout(() => modal.classList.add('hidden'), 300); // Espera que termine la animación
                this.currentTerceroId = null;
            }
        }
    },

    toggleDrawer(show) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('drawer-overlay');
        if (sidebar && overlay) {
            if (show) {
                sidebar.classList.add('active');
                overlay.classList.add('active');
            } else {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            }
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
