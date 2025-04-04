// main.js

// --- Constantes de Cifrado ---
const SALT_KEY = 'tasksSalt';
const ENCRYPTED_DATA_KEY = 'encryptedAppData'; // Clave para todo el estado
const PBKDF2_ITERATIONS = 10000;
const KEY_SIZE_BITS = 256;

// Variable global para la clave derivada (en memoria)
let sessionKey = null;
// Arrays para tareas activas y borradas
let tasksData = [];
let deletedTasks = [];

// --- Variables Globales para Three.js ---
// (Declaradas aquí para que sean accesibles si se necesitan fuera de init, aunque en este caso no es estrictamente necesario)
let scene, camera, renderer, triangle;

document.addEventListener('DOMContentLoaded', () => {
  // --- Referencias a elementos del DOM ---
  const taskInput = document.getElementById('taskInput');
  const dueDateInput = document.getElementById('dueDateInput');
  const addTaskForm = document.getElementById('addTaskForm');
  const taskList = document.getElementById('taskList');
  const imageUpload = document.getElementById('imageUpload'); // Aunque no se usa, lo dejamos por si acaso
  const customImage = document.getElementById('customImage');
  const customImageContainer = document.getElementById('customImageContainer');
  const mainContent = document.getElementById('mainContent');

  // Modal de contraseña
  const passwordOverlay = document.getElementById('passwordOverlay');
  const passwordForm = document.getElementById('passwordForm');
  const passwordInput = document.getElementById('passwordInput');
  const passwordError = document.getElementById('passwordError');
  const passwordTitle = document.getElementById('passwordTitle');
  const passwordSubmit = document.getElementById('passwordSubmit');

  // Papelera
  const trashOverlay = document.getElementById('trashOverlay');
  const showTrashBtn = document.getElementById('showTrashBtn');
  const closeTrashBtn = document.getElementById('closeTrashBtn');
  const deletedTaskList = document.getElementById('deletedTaskList');
  const trashCountSpan = document.getElementById('trashCount');
  const emptyTrashMessage = document.getElementById('emptyTrashMessage');
  initApp();
  initThreeBackground();

// --- Función para inicializar el fondo Three.js ---
function initThreeBackground() {
    const container = document.getElementById('threejs-background');
    if (!container) {
      console.error("El contenedor #threejs-background no se encontró.");
      return;
    }

    // 1. Escenalet targetRotationY = 0; // Rotación acumulada objetivo
    // let rotationSpeed = 0.1; // Velocidad de rotación (ajustable)
    scene = new THREE.Scene();
    let model = null; // El gato
    let velocity = new THREE.Vector3(0.01, 0.008, 0); // Velocidad inicial en X e Y
    let modelBoxSize = new THREE.Vector3(); // Tamaño del modelo
    

    // Crear el loader para modelos GLTF
    const loader = new THREE.GLTFLoader();

    // luz natural
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Luz blanca, intensidad 1
    scene.add(ambientLight);

    // 2. Cámara (PerspectiveCamera)
    const fov = 75;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 100;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.z = 4;

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true // Fondo transparente
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 4. Crear la pirámide (ConeGeometry con base cuadrada)
    const radius = 1;
    const height = 1.8;
    const radialSegments = 4;
    const geometry = new THREE.ConeGeometry(radius, height, radialSegments);
    const material = new THREE.MeshBasicMaterial({
      color: 0x39FF14, // Verde neón
      wireframe: true
    });
    //const pyramid = new THREE.Mesh(geometry, material);

    // 5. Crear un grupo para combinar pirámide y modelo GLB
    //group = new THREE.Group();
    //group.add(pyramid); // Añadir la pirámide al grupo
    const group = new THREE.Group();

    scene.add(group);   // Añadir el grupo a la escena

    // 6. Cargar el modelo GLB
    loader.load('models/cat.glb', function (gltf) {
        model = gltf.scene;
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0); // Centro
        
        // Fijar rotación para que el gato mire hacia la cámara
        model.rotation.y = 0; // Girar 180 grados
        
        // Establecer velocidad inicial
        velocity = new THREE.Vector3(0.015, 0.01, 0); // Velocidad solo en X e Y
      
        // Calcular el tamaño del modelo
        const box = new THREE.Box3().setFromObject(model);
        box.getSize(modelBoxSize); // Guardamos para los rebotes
      
        group.add(model);
        
        // Aplicar un color inicial al modelo
        changeModelColor(model);
        
        console.log("Modelo GLB cargado exitosamente.");
      }, 
      // onProgress callback
      function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      // onError callback
      function (error) {
        console.error('Error cargando el modelo:', error);
      }
    );

// Variables para controlar la animación de rotación
let targetRotationX = 0;
let targetRotationY = 0;
let currentRotationX = 0;
let currentRotationY = 0;
let isRotating = false;
let rotationSpeed = 0.1; // Velocidad de la animación de rotación (ajustable)

function animate() {
    requestAnimationFrame(animate);
    
    if (model) {
      // Animar la rotación si está activa
      if (isRotating) {
        // Interpolar suavemente hacia la rotación objetivo en Y
        if (Math.abs(model.rotation.y - targetRotationY) > 0.01) {
          model.rotation.y += (targetRotationY - model.rotation.y) * rotationSpeed;
        }
        // Interpolar suavemente hacia la rotación objetivo en X
        if (Math.abs(model.rotation.x - targetRotationX) > 0.01) {
          model.rotation.x += (targetRotationX - model.rotation.x) * rotationSpeed;
        }
        
        // Verificar si la animación ha terminado
        if (Math.abs(model.rotation.y - targetRotationY) <= 0.01 && 
            Math.abs(model.rotation.x - targetRotationX) <= 0.01) {
          // Establecer las rotaciones exactas y finalizar la animación
          model.rotation.y = targetRotationY;
          model.rotation.x = targetRotationX;
          isRotating = false;
        }
      }
      
      // Mover el modelo
      model.position.x += velocity.x;
      model.position.y += velocity.y;
  
      // Calcular los límites visibles en el plano z=0
      const distance = Math.abs(camera.position.z - model.position.z);
      const vFOV = THREE.MathUtils.degToRad(camera.fov);
      const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
      const visibleWidth = visibleHeight * camera.aspect;
  
      // Límites para el rebote, restando la mitad del tamaño del modelo
      const limitX = visibleWidth / 2 - modelBoxSize.x / 2;
      const limitY = visibleHeight / 2 - modelBoxSize.y / 2;
  
      // Comprobar y rebotar en los límites horizontales con cambio de color y rotación
      if (model.position.x > limitX || model.position.x < -limitX) {
        velocity.x *= -1;
        model.position.x = THREE.MathUtils.clamp(model.position.x, -limitX, limitX);
        
        // Cambiar color del modelo (efecto DVD)
        changeModelColor(model);
        
        // Iniciar animación de rotación en Y
        targetRotationY = model.rotation.y + Math.PI * 6; // Gira 90 grados
        isRotating = true;
      }
      
      // Comprobar y rebotar en los límites verticales con cambio de color y rotación
      if (model.position.y > limitY || model.position.y < -limitY) {
        velocity.y *= -1;
        model.position.y = THREE.MathUtils.clamp(model.position.y, -limitY, limitY);
        
        // Cambiar color del modelo (efecto DVD)
        changeModelColor(model);
        
        // Iniciar animación de rotación en X
        targetRotationX = model.rotation.y + Math.PI * 6; // Gira 90 grados
        isRotating = true;
      }
    }
    
    renderer.render(scene, camera);
}
    // Función para cambiar el color del modelo (efecto DVD)
    function changeModelColor(model) {
      // Generar un color aleatorio brillante
      const hue = Math.random() * 360;
      const color = new THREE.Color(`hsl(${hue}, 100%, 70%)`);
      
      // Aplicar el color a todos los materiales del modelo
      model.traverse(function(child) {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.emissive = color;
              mat.emissiveIntensity = 0.5;
            });
          } else {
            child.material.emissive = color;
            child.material.emissiveIntensity = 0.5;
          }
        }
      });
    }
    animate();

    // 8. Manejo del Redimensionamiento
    window.addEventListener('resize', onWindowResize, false);

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
  // --- Resto del código de la aplicación de tareas (SIN CAMBIOS) ---

  function initApp() {
    const storedSalt = localStorage.getItem(SALT_KEY);
    const encryptedData = localStorage.getItem(ENCRYPTED_DATA_KEY);

    passwordOverlay.style.display = 'flex'; // Mostrar modal de contraseña

    if (storedSalt && encryptedData) {
      passwordTitle.textContent = 'Introduce la contraseña';
      passwordSubmit.textContent = 'Desbloquear';
    } else {
      passwordTitle.textContent = 'Crea una contraseña para cifrar tus tareas';
      passwordSubmit.textContent = 'Guardar y Empezar';
      if (!storedSalt) {
        const newSalt = CryptoJS.lib.WordArray.random(128 / 8).toString(CryptoJS.enc.Hex);
        localStorage.setItem(SALT_KEY, newSalt);
        console.log("Nueva sal generada.");
      }
      if (!encryptedData) {
        localStorage.removeItem(ENCRYPTED_DATA_KEY); // Limpiar por si acaso
        tasksData = [];
        deletedTasks = [];
        console.log("No hay datos cifrados, inicializando.");
      }
    }
    passwordForm.onsubmit = handlePasswordSubmit;
  }

  function handlePasswordSubmit(e) {
    e.preventDefault();
    const password = passwordInput.value;
    const salt = localStorage.getItem(SALT_KEY);
    passwordError.textContent = ''; // Limpiar errores previos

    if (!password) {
      passwordError.textContent = 'La contraseña no puede estar vacía.';
      return;
    }
    if (!salt) {
      passwordError.textContent = 'Error crítico: Falta la sal de cifrado.';
      console.error("Error crítico: Falta la sal de cifrado.");
      return;
    }

    console.log("Derivando clave...");
    sessionKey = deriveKey(password, salt);
    console.log("Clave derivada (oculta en producción).");

    const encryptedData = localStorage.getItem(ENCRYPTED_DATA_KEY);

    if (encryptedData) {
      console.log("Intentando descifrar datos existentes...");
      const decryptedJson = decryptData(encryptedData, sessionKey);
      if (decryptedJson !== null) {
        try {
          const appData = JSON.parse(decryptedJson);
          // Validar estructura básica
          tasksData = Array.isArray(appData.tasks) ? appData.tasks : [];
          deletedTasks = Array.isArray(appData.deleted) ? appData.deleted : [];
          console.log(`Datos descifrados: ${tasksData.length} tareas, ${deletedTasks.length} en papelera.`);
          unlockApp();
        } catch (error) {
          console.error("Error al parsear JSON descifrado:", error);
          passwordError.textContent = 'Contraseña incorrecta o datos corruptos.';
          sessionKey = null; // Resetear clave
          passwordInput.value = ''; // Limpiar campo
        }
      } else {
        console.warn("Descifrado fallido (probablemente contraseña incorrecta).");
        passwordError.textContent = 'Contraseña incorrecta o datos corruptos.';
        sessionKey = null; // Resetear clave
        passwordInput.value = ''; // Limpiar campo
      }
    } else {
      // Primera vez o datos borrados
      console.log("No hay datos cifrados, empezando con listas vacías.");
      tasksData = [];
      deletedTasks = [];
      unlockApp();
      saveAppData(); // Guardar el estado inicial (vacío pero cifrado)
    }
  }

  function unlockApp() {
    passwordOverlay.style.display = 'none';
    passwordInput.value = ''; // Limpiar campo de contraseña por seguridad
    mainContent.classList.remove('content-hidden'); // Mostrar contenido
    customImageContainer.classList.remove('content-hidden'); // Mostrar imagen

    renderTasks(); // Dibujar tareas activas
    updateTrashCount(); // Actualizar contador de papelera

    // Añadir listeners de eventos (asegurarse de no duplicarlos)
    addTaskForm.removeEventListener('submit', handleAddTask);
    addTaskForm.addEventListener('submit', handleAddTask);

    taskList.removeEventListener('click', handleTaskListClick);
    taskList.addEventListener('click', handleTaskListClick);

    showTrashBtn.removeEventListener('click', openTrashModal);
    showTrashBtn.addEventListener('click', openTrashModal);

    closeTrashBtn.removeEventListener('click', closeTrashModal);
    closeTrashBtn.addEventListener('click', closeTrashModal);

    deletedTaskList.removeEventListener('click', handleTrashListClick);
    deletedTaskList.addEventListener('click', handleTrashListClick);

    console.log("Aplicación desbloqueada y listeners añadidos.");
  }

  function handleAddTask(e) {
    e.preventDefault();
    const taskText = taskInput.value.trim();
    const dueDate = dueDateInput.value;
    if (!taskText) return; // No añadir tareas vacías

    const newTask = {
      text: taskText,
      dueDate: dueDate || '',
      completed: false,
      isPriority: false, // Por defecto no es prioritaria
      id: Date.now() // ID único basado en timestamp
    };

    tasksData.push(newTask);

    renderTasks(); // Re-renderizar lista principal (para ordenación)
    saveAppData(); // Guardar cambios
    taskInput.value = ''; // Limpiar input de texto
    dueDateInput.value = ''; // Limpiar input de fecha
    taskInput.focus(); // Poner el foco de nuevo en el input de texto
  }

  // --- Manejador de Clicks en la Lista Principal ---
  function handleTaskListClick(e) {
    const target = e.target;
    const li = target.closest('li'); // Encontrar el <li> padre
    if (!li) return; // Salir si el click no fue dentro de un <li>

    const taskId = parseInt(li.dataset.taskId, 10);
    const taskIndex = tasksData.findIndex(task => task.id === taskId);
    if (taskIndex === -1) {
        console.warn(`Tarea con ID ${taskId} no encontrada en tasksData.`);
        return; // Tarea no encontrada (raro, pero posible)
    }

    // Click en Checkbox (Completar/Descompletar)
    if (target.type === 'checkbox') {
      tasksData[taskIndex].completed = target.checked;
      li.classList.toggle('completed', target.checked); // Actualizar clase CSS
      // Actualizar el tachado explícitamente si es necesario
      const textSpan = li.querySelector('.task-content span');
      if (textSpan) {
        textSpan.style.textDecoration = target.checked ? 'line-through' : 'none';
      }
      saveAppData(); // Guardar el cambio
    }
    // Click en Botón de Prioridad
    else if (target.classList.contains('priority-btn')) {
      tasksData[taskIndex].isPriority = !tasksData[taskIndex].isPriority;
      // Re-renderizar toda la lista para mantener el orden por prioridad
      renderTasks();
      saveAppData();
    }
    // Click en Botón de Eliminar (Mover a Papelera)
    else if (target.classList.contains('delete-btn')) {
      // Eliminar la confirmación por ahora para simplificar
      const taskToMove = tasksData.splice(taskIndex, 1)[0]; // Quitar de tasksData
      if (taskToMove) {
        taskToMove.deletedAt = Date.now(); // Añadir timestamp de borrado
        deletedTasks.push(taskToMove); // Añadir a deletedTasks

        li.remove(); // Quitar del DOM visualmente
        updateTrashCount(); // Actualizar contador
        saveAppData(); // Guardar cambios
        console.log(`Tarea ${taskId} movida a la papelera.`);
      } else {
        console.error(`No se pudo encontrar la tarea ${taskId} para eliminar.`);
      }
    }
  }

  // --- Manejador de Clicks en la Papelera ---
  function handleTrashListClick(e) {
     const target = e.target;
     const li = target.closest('li');
     if (!li) return;

     const taskId = parseInt(li.dataset.taskId, 10);
     const taskIndex = deletedTasks.findIndex(task => task.id === taskId);
     if (taskIndex === -1) {
         console.warn(`Tarea con ID ${taskId} no encontrada en deletedTasks.`);
         return; // Tarea no encontrada en la papelera
     }

     // Click en Restaurar
     if (target.classList.contains('restore-btn')) {
        const taskToRestore = deletedTasks.splice(taskIndex, 1)[0]; // Quitar de la papelera
        if (taskToRestore) {
            delete taskToRestore.deletedAt; // Quitar timestamp de borrado
            tasksData.push(taskToRestore); // Añadir de nuevo a tareas activas

            renderTasks(); // Re-renderizar lista principal
            renderTrash(); // Re-renderizar papelera (ahora tiene un item menos)
            updateTrashCount(); // Actualizar contador
            saveAppData(); // Guardar cambios
            console.log(`Tarea ${taskId} restaurada.`);
        }
     }
     // Click en Borrar Permanentemente
     else if (target.classList.contains('perm-delete-btn')) {
        // Añadir confirmación para borrado permanente
        if (confirm(`¿Seguro que quieres eliminar permanentemente la tarea "${deletedTasks[taskIndex].text}"? Esta acción no se puede deshacer.`)) {
            deletedTasks.splice(taskIndex, 1); // Eliminar definitivamente

            li.remove(); // Quitar del DOM de la papelera
            updateTrashCount(); // Actualizar contador
            saveAppData(); // Guardar cambios
            checkEmptyTrash(); // Verificar si la papelera quedó vacía y mostrar mensaje
            console.log(`Tarea ${taskId} eliminada permanentemente.`);
        }
     }
  }

  // --- Funciones de Cifrado ---
  function deriveKey(password, salt) {
    const saltWA = (typeof salt === 'string') ? CryptoJS.enc.Hex.parse(salt) : salt;
    return CryptoJS.PBKDF2(password, saltWA, {
      keySize: KEY_SIZE_BITS / 32,
      iterations: PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    });
  }

  function encryptData(plaintext, key) {
    if (!key) { console.error("Error de cifrado: Falta la clave."); return null; }
    try {
      const iv = CryptoJS.lib.WordArray.random(128 / 8);
      const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
      const ivBase64 = CryptoJS.enc.Base64.stringify(iv);
      return ivBase64 + ':' + encrypted.toString();
    } catch (error) { console.error("Error durante el cifrado:", error); return null; }
  }

  function decryptData(ciphertextWithIv, key) {
    if (!key) { console.error("Error de descifrado: Falta la clave."); return null; }
    try {
      const parts = ciphertextWithIv.split(':');
      if (parts.length !== 2) { console.error("Error de descifrado: Formato inválido (falta separador IV)."); return null; }
      const iv = CryptoJS.enc.Base64.parse(parts[0]);
      const ciphertext = parts[1];
      const decrypted = CryptoJS.AES.decrypt(ciphertext, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
      const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
      // Comprobación adicional: si el texto descifrado está vacío pero el cifrado no lo estaba, probablemente sea incorrecto.
      if (!plaintext && ciphertext.length > 0) {
        console.warn("Descifrado resultó en cadena vacía, posible clave incorrecta o datos corruptos.");
        return null; // Indica fallo
      }
      return plaintext;
    } catch (error) {
      console.error("Error durante el descifrado (puede ser clave incorrecta o datos corruptos):", error);
      return null; // Indica fallo
    }
  }

  // --- Persistencia (Guardar Estado Completo) ---
  function saveAppData() {
    if (!sessionKey) {
        console.warn("Intento de guardar sin clave de sesión.");
        // Podrías mostrar un mensaje al usuario aquí si es crítico
        // alert("Error de seguridad: No se puede guardar. Intenta recargar.");
        return; // No guardar si no hay clave
    }
    const appData = {
        tasks: tasksData,
        deleted: deletedTasks
    };
    const appDataJson = JSON.stringify(appData);
    const encryptedData = encryptData(appDataJson, sessionKey);

    if (encryptedData) {
      localStorage.setItem(ENCRYPTED_DATA_KEY, encryptedData);
      // console.log("Datos de aplicación guardados cifrados."); // Log de depuración útil
    } else {
      // Considera un mensaje más robusto para el usuario en caso de fallo de guardado
      alert("Error crítico: No se pudieron guardar los cambios de forma segura. Por favor, revisa la consola y considera recargar.");
      console.error("Fallo al cifrar datos para guardar.");
    }
  }

  // --- Renderizado de Tareas Activas ---
  function renderTasks() {
    taskList.innerHTML = ''; // Limpiar lista actual
    if (!Array.isArray(tasksData)) tasksData = []; // Asegurar que sea un array

    // Ordenar: Prioritarias primero, luego incompletas, luego completas. Dentro de cada grupo, por ID (fecha creación)
    const sortedTasks = [...tasksData].sort((a, b) => {
        if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1; // Prioritarias primero
        if (a.completed !== b.completed) return a.completed ? 1 : -1; // Incompletas antes que completas
        return a.id - b.id; // Mismo estado, ordenar por creación (más antiguas primero)
    });

    sortedTasks.forEach(task => renderSingleTask(task)); // Usamos la función refactorizada
    // console.log("Lista de tareas renderizada."); // Log de depuración
  }

  function renderSingleTask(task) { // Eliminado el parámetro existingLi, siempre creamos uno nuevo
     const li = document.createElement('li');
     li.dataset.taskId = task.id; // Añadir dataset ID
     li.className = ''; // Limpiar clases previas
     if (task.completed) li.classList.add('completed');
     if (task.isPriority) li.classList.add('is-priority');

     // Contenedor principal para contenido y acciones (usando Flexbox desde CSS)
     // No es necesario aplicar estilos flex aquí si están en CSS

     // --- Task Content (Checkbox, Icono Prioridad, Texto, Fecha) ---
     const taskContent = document.createElement('div');
     taskContent.classList.add('task-content');

     const checkbox = document.createElement('input');
     checkbox.type = 'checkbox';
     checkbox.checked = task.completed;
     checkbox.title = task.completed ? "Marcar como pendiente" : "Marcar como completada";
     taskContent.appendChild(checkbox);

     // Icono de Prioridad (visible/oculto por CSS basado en la clase .is-priority del li)
     const priorityIcon = document.createElement('span');
     priorityIcon.classList.add('priority-icon');
     priorityIcon.innerHTML = '❗'; // Puedes usar un icono SVG o FontAwesome si prefieres
     priorityIcon.title = "Tarea prioritaria";
     taskContent.appendChild(priorityIcon);

     // Texto de la tarea
     const textSpan = document.createElement('span');
     textSpan.textContent = task.text;
     textSpan.title = task.text; // Tooltip con texto completo
     if (task.completed) { // Aplicar tachado directamente
        textSpan.style.textDecoration = 'line-through';
     }
     taskContent.appendChild(textSpan);

     // Fecha límite (si existe)
     if (task.dueDate) {
       const dateSpan = document.createElement('span');
       dateSpan.classList.add('due-date');
       dateSpan.textContent = `(${formatDate(task.dueDate)})`;
       taskContent.appendChild(dateSpan);
     }
     li.appendChild(taskContent); // Añadir contenido a li

     // --- Task Actions (Botones) ---
     const taskActions = document.createElement('div');
     taskActions.classList.add('task-actions');

     // Botón Prioridad
     const priorityBtn = document.createElement('button');
     priorityBtn.classList.add('priority-btn');
    //  priorityBtn.classList.toggle('active', task.isPriority); // La clase 'active' no parece usarse, la clase 'is-priority' en li controla el estilo
     priorityBtn.innerHTML = '⭐'; // Usar icono de estrella (o '!')
     priorityBtn.title = task.isPriority ? "Quitar prioridad" : "Marcar como prioritaria";
     taskActions.appendChild(priorityBtn);

     // Botón Eliminar (a papelera)
     const deleteBtn = document.createElement('button');
     deleteBtn.classList.add('delete-btn');
     deleteBtn.innerHTML = '🗑️'; // Icono de papelera (o '×')
     deleteBtn.title = 'Mover a la papelera';
     taskActions.appendChild(deleteBtn);

     li.appendChild(taskActions); // Añadir acciones a li

     taskList.appendChild(li); // Añadir el elemento li completo a la lista ul
  }

  // --- Funciones de la Papelera ---
  function openTrashModal() {
      renderTrash(); // Asegurar contenido actualizado
      trashOverlay.style.display = 'flex'; // Mostrar modal
  }

  function closeTrashModal() {
      trashOverlay.style.display = 'none'; // Ocultar modal
  }

  function renderTrash() {
      deletedTaskList.innerHTML = ''; // Limpiar lista de papelera
      if (!Array.isArray(deletedTasks)) deletedTasks = []; // Asegurar array

      checkEmptyTrash(); // Mostrar/ocultar mensaje de vacío

      // Ordenar tareas borradas por fecha de borrado (más recientes primero)
      const sortedDeletedTasks = [...deletedTasks].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

      sortedDeletedTasks.forEach(task => {
        const li = document.createElement('li');
        li.dataset.taskId = task.id;
        // Aplicar clases para consistencia visual (aunque no funcionales aquí)
        if (task.completed) li.classList.add('completed');
        if (task.isPriority) li.classList.add('is-priority');
        // li.style.opacity = 0.8; // Opcional: Atenuar ligeramente las tareas borradas

        // --- Contenido de la tarea borrada ---
        const taskContent = document.createElement('div');
        taskContent.classList.add('task-content'); // Reusar clase para estilos

        // Icono de prioridad (si aplica) - Usar la clase is-priority del LI para mostrar/ocultar con CSS
        const priorityIcon = document.createElement('span');
        priorityIcon.classList.add('priority-icon');
        priorityIcon.innerHTML = '❗';
        taskContent.appendChild(priorityIcon);

        // Texto (tachado si estaba completada)
        const textSpan = document.createElement('span');
        textSpan.textContent = task.text;
        textSpan.title = task.text;
         if (task.completed) textSpan.style.textDecoration = 'line-through';
        taskContent.appendChild(textSpan);

        // Fecha límite (si aplica)
        if (task.dueDate) {
          const dateSpan = document.createElement('span');
          dateSpan.classList.add('due-date');
          dateSpan.textContent = `(${formatDate(task.dueDate)})`;
          taskContent.appendChild(dateSpan);
        }

        // Fecha de borrado
        if (task.deletedAt) {
            const deletedInfoSpan = document.createElement('span');
            deletedInfoSpan.classList.add('deleted-info');
            deletedInfoSpan.textContent = `[Borrado: ${formatDateTime(task.deletedAt)}]`;
            deletedInfoSpan.style.fontSize = '0.8em'; // Hacerlo un poco más pequeño
            deletedInfoSpan.style.marginLeft = '10px'; // Espacio
            deletedInfoSpan.style.color = '#888'; // Color grisáceo
            taskContent.appendChild(deletedInfoSpan);
        }

        li.appendChild(taskContent);

        // --- Acciones en la papelera ---
        const taskActions = document.createElement('div');
        taskActions.classList.add('task-actions'); // Reusar clase para estilos

        // Botón Restaurar
        const restoreBtn = document.createElement('button');
        restoreBtn.classList.add('restore-btn');
        restoreBtn.innerHTML = '↺'; // Icono de restaurar
        restoreBtn.title = 'Restaurar tarea';
        taskActions.appendChild(restoreBtn);

        // Botón Borrar Permanentemente
        const permDeleteBtn = document.createElement('button');
        permDeleteBtn.classList.add('perm-delete-btn');
        permDeleteBtn.innerHTML = '❌'; // Icono de cruz roja (o papelera '🗑️')
        permDeleteBtn.title = 'Eliminar permanentemente';
        taskActions.appendChild(permDeleteBtn);

        li.appendChild(taskActions);
        deletedTaskList.appendChild(li);
      });
      // console.log("Papelera renderizada."); // Log de depuración
  }

  function updateTrashCount() {
    const count = Array.isArray(deletedTasks) ? deletedTasks.length : 0;
    trashCountSpan.textContent = `(${count})`;
  }

  function checkEmptyTrash() {
      const isEmpty = !Array.isArray(deletedTasks) || deletedTasks.length === 0;
      emptyTrashMessage.style.display = isEmpty ? 'block' : 'none';
      deletedTaskList.style.display = isEmpty ? 'none' : 'block'; // Ocultar ul si está vacío
  }

  // --- Funciones de Utilidad ---
  function formatDate(dateString) {
    if (!dateString) return '';
    try {
      // Intenta parsear como YYYY-MM-DD. Añadir T00:00:00 previene problemas de zona horaria
      // que podrían hacer que la fecha cambie al día anterior.
      const date = new Date(dateString + 'T00:00:00');
      if (isNaN(date.getTime())) {
          console.warn("Fecha inválida al formatear:", dateString);
          return dateString; // Devolver original si no es válida
      }
      // Formato DD/MM/YYYY
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Meses son 0-indexados
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      console.error("Error formateando fecha:", dateString, e);
      return dateString; // Devolver original en caso de error inesperado
    }
  }

  function formatDateTime(timestamp) {
      if (!timestamp) return '';
      try {
          const date = new Date(timestamp);
          if (isNaN(date.getTime())) {
              console.warn("Timestamp inválido al formatear:", timestamp);
              return '';
          }
          // Usar toLocaleString para formato local de fecha y hora
          return date.toLocaleString('es-ES', { // Formato local español
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
              // second: '2-digit' // Opcional: añadir segundos
          });
      } catch(e) {
          console.error("Error formateando fecha/hora:", timestamp, e);
          // Fallback simple si toLocaleString falla
          return new Date(timestamp).toLocaleDateString('es-ES');
      }
  }

}); // Fin DOMContentLoaded