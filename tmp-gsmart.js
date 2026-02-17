$(window).load(function(){ $('header#header').animate({'opacity': '1'},500); });
$(document).ready(function(){
    JQueryHelper.load();
    FormHelper.load();
    DivHelper.load();
    Tools.load();
    CargarSelect2.load();
    ControlDeTiempos();
    Tutoriales.load();
    mostrar_datos_facturacion();
    form_proveedor();
    LicenciaAutogest.load();
    //makeSticky();
    //resizeEnd();
    acordeon_info();
    select_estado_servicio();
    DetalleLineas.load();
    selecLevelsArticlesTree();
    actualizar_datos_distribuidor_erp();
    close_alert_box();
    loadGMSAngular();
});

var acordeon_info = function() {
    $('.acordeon-js').click(function () {
        let objeto = $(this);
        if($(this).hasClass('abierto'))
        {
            $('.'+objeto.data('acordeon')).slideUp();
            objeto.removeClass('abierto');
        }
        else
        {
            $('.'+objeto.data('acordeon')).slideDown();
            objeto.addClass('abierto');
        }
    });
}

var select_estado_servicio = function(){
    //cambio del select de estado de servicio
    $('.estado_servicio-js').on('change', function (){
        $seleccionado = $('.estado_servicio-js option:selected').val();
        $cliente = $(this).data('user');
        $url = $(this).data('url');
        $(location).attr('href',$url + '?estado='+ $seleccionado);
    });
}


var makeSticky = function() {
    /*
    var altoVentana = $(window).height();
    var anchoVentana = $(window).width();
    var altoElemento = $('.color_fondo').outerHeight();
    if(anchoVentana > 700)
    {
        if(altoElemento > (altoVentana - 180))
        {
            $('.color_fondo').css({'position': 'static'});
        }
        else
        {
            $('.color_fondo').css({'position': 'sticky'});
        }
    }
    else
    {
        $('.color_fondo').css({'position': 'static'});
    }
    */
}
var rtime;
var timeout = false;
var delta = 200;
var resizeEnd = function() {
    /*
    $(window).resize(function()
    {
        rtime = new Date();
        if(timeout === false)
        {
            timeout = true;
            setTimeout(resizeCondicional, delta);
        }
    });
    */
}
function resizeCondicional()
{
    /*
    if(new Date() - rtime < delta)
    {
        setTimeout(resizeEnd, delta);
    }
    else
    {
        timeout = false;
        makeSticky();
    }
    */
}

var limitar_caracteres = function(selector, limite_caracteres) {
    var input = $(selector);
    input.attr('maxlength',limite_caracteres);
    input.keyup(function(e){
        if(input.val().length == limite_caracteres){
            SweetAlert.cargarComportamientoSweetModal(4, '', 'Se ha superado el limite de caracteres');
        }
    });
}
var buscador_producto = function () {
    $.ajax({
        dataType: "json",
        type: "POST",
        url: WEB + 'identificacion_vehiculo/identificacion_vehiculo/obtener_genarts_buscar',
        cache: false,
        success: function (data) {
            var genarts = [];
            $.each(data, function (key, value) {
                genarts.push(value.name);
            });
            $("#producto-busqueda-js").autocomplete({
                minLength: 3,// número de letras en las que empieza a buscar
                source: genarts,
                focus: function (event, ui) {
                    $("#producto-busqueda-js").val(ui.item.label);
                    return false;
                },
                select: function (event, ui) {
                    $("#buscar-cabecera-js").trigger("click");
                }
            });
        },
        error: function () {
            //alert($('#alert_error_text-js').data('text'));
        }
    });
}

var actualizar_alto = function () {
    $(document).foundation();
}

var mostrar_datos_facturacion = function () {
    $('#mostar-datos-facturacion-js').click(function () {
        if ($('#datos-facturacion-js').hasClass('oculto')){
            $('#datos-facturacion-js').removeClass('oculto');
        }else{
            $('#datos-facturacion-js').addClass('oculto');
        }
    });
};

var reemplazarHtmlAjax = function(metodo, div, datos = null, reintentos = 0){
    var data = {};
    data.datos = datos;

    if(reintentos<3){
        $.ajax({
            dataType: "html",
            async: true,
            type: "POST",
            url: WEB + metodo,
            data: data,
            cache: false,
            success: function (data) {
                $(div).replaceWith(data);
            },
            error: function () {
                reemplazarHtmlAjax(metodo, div, datos, reintentos+=1)
            }
        })
    }
};

var cargarHtmlAjax = function(metodo, div, datos = null, reintentos = 0){
    var data = {};
    data.datos = datos;

    if(reintentos<3){
        $.ajax({
            dataType: "html",
            async: true,
            type: "POST",
            url: WEB + metodo,
            data: data,
            cache: false,
            success: function (data) {
                $(div).html(data);
            },
            error: function () {
                cargarHtmlAjax(metodo, div, datos, reintentos+=1)
            }
        })
    }
};

var form_proveedor = function () {
    $('#anadir-form-proveedor-horario-js').click(function () {
        var num_horarios = parseInt($('#num-horarios-js').val());
        num_horarios = num_horarios + 1;
        $('#num-horarios-js').val(num_horarios);
        $.ajax({
            dataType: "html",
            async: true,
            type: "POST",
            url: WEB + 'proveedores/form_horario',
            data: {
                'num_horarios': num_horarios,
            },
            cache: false,
            success: function (data) {
                $('#horarios-proveedor-js').append(data);
                JQueryHelper.cargarTimepicker();
            },
            error: function () {
                alert($('#alert_error_text-js').data('text'));
            }
        })
    });
    $('#eliminar-form-proveedor-horario-js').click(function () {
        var num_horarios = parseInt($('#num-horarios-js').val());
        if (num_horarios>1){
            num_horarios = num_horarios - 1;
            $('#num-horarios-js').val(num_horarios);
            $('#horario_' + num_horarios).remove();
        }
    });
};

var ControlDeTiempos = function() {
    $("#tiempos-select-tareas-js").change(function() {
        $("#check-linea-terminada-js").hide();
        $("#input-centro-js").show();
        if($(this).val() == '') {
            $("#check-linea-terminada-js").show();
            $("#input-centro-js").hide();
        }
    });
    $("#tiempos-select-lineas-or-js").change(function() {

        $("#check-linea-terminada-js").show();
        $("#input-centro-js").hide();

        if($(this).val() == '') {
           $("#check-linea-terminada-js").hide();
           $("#input-centro-js").show();
        }
    });
    $(".mostrar-modal-desde-proceso-js").click(function() {
        var url = $(this).data('url');
        $("#ModalOperarios").foundation('reveal', 'open', url);
    });
    $(".terminar-linea-mano-obra-js").click(function() {
        $datos_js = $(this);
        SweetAlert.sweetAlertPregunta($datos_js.data('mensaje-confirm'), '', function(isConfirmed) {
            if (isConfirmed) {
                $.post($datos_js.data('url'), {'linea_id': $datos_js.data('linea-id')}, function(res) {
                    var obj = JSON.parse(res);

                    if (obj.status == "OK") {
                        SweetAlert.cargarComportamientoSweetModal(3, '', $datos_js.data('mensaje-exito'));
                        window.location.reload(true);
                    }
                    else {
                        SweetAlert.cargarComportamientoSweetModal(4, 'Error', '');
                    }
                })
            }
        });
    });
    $('.actualizar-fecha').change(function() {
        actualizarFechaFin();
    });
    $('.actualizar-fecha-fin').change(function() {
        actualizarDuracion();
    });

    $('.cargar-jornada-js').change(function() {
        var data = {};
        data.usuario_id = $('#selector_mecanico_js').val();
        data.fecha = $('#selector_fechas_js').val();
        if(data.usuario_id && data.fecha){
            var request = PeticionAjax.post('/entradas/ajax_cargar_jornada', data);
            PeticionAjax.mostrarCargando();

            request.done(function(data){
                var IS_JSON = true;
                try {
                    var json = $.parseJSON(data);
                }
                catch(err) {
                    IS_JSON = false;
                }

                if(IS_JSON) {
                    var obj = $.parseJSON(data);
                    SweetAlert.cargarComportamientoSweetModal(4, obj.texto, '');
                }
                else {
                    $('#div-jornada-js').html(Tools.sanitizeHtml(data));
                }
                PeticionAjax.ocultarCargando();
            });
        }
    });

    function actualizarDuracion() {
        var fecha_inicio = $('#hora_inicio_js').val();
        var fecha_fin = $('#hora_fin_js').val();
    
        if (fecha_inicio && fecha_fin) {
            var duracion = calcularDuracion(fecha_inicio, fecha_fin);
            $('#duracion_js').val(duracion);
        }
    }

    function actualizarFechaFin() {
        var fecha_inicio = $('#hora_inicio_js').val();
        var duracion = convertH2M($('#duracion_js').val());
    
        if (fecha_inicio && duracion) {
            var fecha_fin = moment(toDateHM(fecha_inicio, 'h:m')).add(duracion, 'm').toDate();
            fecha_fin = moment(fecha_fin).format('HH:mm');
            $('#hora_fin_js').val(fecha_fin);
        }
    }

    function calcularDuracion(fechaInicio, fechaFin) {
        //La duracion no se guarda en bd
        var duracionMinutos = moment(fechaFin, 'HH:mm').diff(moment(fechaInicio, 'HH:mm'), 'minutes');
        var horas = Math.floor(duracionMinutos / 60);
        var minutos = duracionMinutos % 60;
    
        // Añadir un cero delante si los minutos son menores a 10
        var minutosFormateados = minutos < 10 ? '0' + minutos : minutos;
    
        return horas + ':' + minutosFormateados;
    }

    function toDateHM(dStr,format) {
        var now = new Date();
        if (format == "h:m") {
        now.setHours(dStr.substr(0,dStr.indexOf(":")));
        now.setMinutes(dStr.substr(dStr.indexOf(":")+1));
        now.setSeconds(0);
        return now;
    }else
        return "Invalid Format";
    }

    function convertH2M(timeInHour){
        var timeParts = timeInHour.split(":");
        return Number(timeParts[0]) * 60 + Number(timeParts[1]);
    }

};
var JQueryHelper  = (function(){
    var ActualizacionesSincronizadas = (function(){
        var tareas = {};
        function anadirTarea(funcion, milisegundos){
            if(!$.isFunction(funcion)){
                throw new Error("La tarea debe ser una función");
            }
            if(!tareas[milisegundos]){
                tareas[milisegundos] = [];
                window.setInterval(function(){
                    var i;
                    for(i=0; i<tareas[milisegundos].length; i++){
                        tareas[milisegundos][i].apply(undefined);
                    }
                }, milisegundos);
            }
            tareas[milisegundos].push(funcion);
        }
        return {
            anadirTarea: anadirTarea
        };
    })();
    var cargarDatepicker = function(){
        $.datepicker.regional['es'] = {
            dayNamesMin: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"],
            dayNamesShort: ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"],
            monthNames: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
            monthNamesShort: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
        };
        $.datepicker.regional['eng'] = {
            dayNamesMin: ['Su','Mo','Tu','We','Th','Fr','Sa'],
            dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            monthNames: ['January','February','March','April','May','June','July','August','September','October','November','December'],
            monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun','Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        };
        $.datepicker.regional['fra'] = {
            dayNamesMin: ['Di','Lu','Ma','Me','Je','Ve','Sa'],
            dayNamesShort: ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'],
            monthNames: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
            monthNamesShort: ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'],
        };
        $.datepicker.regional['deu'] = {
            dayNamesMin: ['So','Mo','Di','Mi','Do','Fr','Sa'],
            dayNamesShort: ['Son','Mon','Die','Mit','Don','Fre','Sam'],
            monthNames: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
            monthNamesShort: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
        };
        $.datepicker.regional['por'] = {
            dayNamesMin: ['Dom','Seg','Ter','Qua','Qui','Sex','S&aacute;b'],
            dayNamesShort: ['Dom','Seg','Ter','Qua','Qui','Sex','S&aacute;b'],
            monthNames: ['Janeiro','Fevereiro','Mar&ccedil;o','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
            monthNamesShort: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
        };
        $.datepicker.regional['ita'] = {
            dayNamesMin: ['Do','Lu','Ma','Me','Gio','Ve','Sa'],
            dayNamesShort: ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'],
            monthNames: ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],
            monthNamesShort: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
        };
        $.datepicker.regional['tur'] = {
            dayNamesShort: ["Pz", "Pzt", "Sal", "Çrş", "Prş", "Cu", "Cts", "Pz"],
            dayNamesMin: ["Pz", "Pzt", "Sa", "Çr", "Pr", "Cu", "Ct", "Pz"],
            monthNames: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
            monthNamesShort: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
        };
        $.datepicker.regional['cat'] = {
            dayNamesMin: ['Dg','Dl','Dt','Dc','Dj','Dv','Ds'],
            dayNamesShort: ['Dug','Dln','Dmt','Dmc','Djs','Dvn','Dsb'],
            monthNames: ['Gener','Febrer','Mar&ccedil;','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre'],
	        monthNamesShort: ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des'],
        };


        $('.fecha-js').each(function(){
            $(this).datepicker({
                dateFormat: 'dd/mm/yy',
                yearRange: "-80:+10",
                changeMonth: true,
                changeYear: true,
                showOn: 'both',
                buttonImage:'/img/iconos/agenda.png',
                buttonImageOnly: true,
                buttonText: 'Seleccionar una fecha',
                firstDay: 1,
            });
        });

        $('.fecha-nacimiento-js').each(function(){
            $(this).datepicker({
                dateFormat: 'dd/mm/yy',
                yearRange: "-80:+0",
                maxDate: 0,
                changeMonth: true,
                changeYear: true,
                showOn: 'both',
                buttonImage:'/img/iconos/agenda.png',
                buttonImageOnly: true,
                buttonText: 'Seleccionar una fecha',
                firstDay: 1,
            });
        });

        $('.fecha-month-js').each(function(){
            $(this).datepicker({
                dateFormat: 'mm/yy',
                showOn: 'both',
                buttonImage:'/img/iconos/agenda.png',
                buttonImageOnly: true,
                firstDay: 1,
                changeMonth: true,
                changeYear: true,
                closeText: "Cambiar",
                currentText: "Hoy",
                showButtonPanel: true,
                onClose: function () {
                    var month = $("#ui-datepicker-div .ui-datepicker-month :selected").val();
                    var year = $("#ui-datepicker-div .ui-datepicker-year :selected").val();
                    $(this).val($.datepicker.formatDate('mm/yy', new Date(year, month, 1)));
                },
                beforeShow: function () {
                    var selDate = $(this).val();
                    if (selDate.length > 0) {
                        var year = selDate.split("/")[1];
                        var month = selDate.split("/")[0] - 1; // se resta 1
                        $(this).datepicker('option', 'defaultDate', new Date(year, month, 1));
                        $(this).datepicker('setDate', new Date(year, month, 1));
                    }
                }
            }).click(function () {
                $(".ui-datepicker-calendar").hide();
            }).focus(function () {
                $(".ui-datepicker-calendar").hide();
            });
            $(this).datepicker("widget").addClass('hide-datepicker-month');
        });
        $.datepicker.setDefaults($.datepicker.regional[$('meta[name="language"]').attr("content")]);
        $(".fecha.min").each(function(){
            $(this).datepicker("option", "minDate", $(this).data('mindate') );
        });
        $(".fecha.max").each(function(){
            $(this).datepicker("option", "maxDate", $(this).data('maxdate') );
        });
        $(".fecha.from").datepicker("option", "onClose", function( selectedDate ) {
            $(".fecha.to").datepicker("option", "minDate", selectedDate );
        });
        $(".fecha.to").datepicker( "option", "onClose", function( selectedDate ) {
            $(".fecha.from").datepicker( "option", "maxDate", selectedDate );
        });
    };
    var cargarTimepicker = function(){
        $.extend($.fn.timepicker.defaults, {
            step: 5,
            timeFormat: "H:i" // http://php.net/manual/en/function.date.php
        });
        /* Selección de una hora del día */
        $(".hora-js").timepicker({
            scrollDefault: "now",
            wrapHours: true
        });
        /* Selección de un internvalo de tiempo */
        $(".tiempo-js").timepicker({
            scrollDefault: "0:15",
            wrapHours: false,
            // El plugin no permite mostrar valores superiores a 24:00 en el desplegable, pero se pueden escribir a mano
            show2400: true
        });
    };
    var cargarDateAutocomplete = function() {
        $('.fecha-js').on('keyup', function(e) {
            var text = $(this).val();
            if( e.keyCode != 8 && (text.length == 2 || text.length == 5) ) {
                $(this).val( text + '/' );
            }
        });
    };
    var cargarFullCalendar = function(){
        var ConfiguracionPersistente = (function(){
            var claveLocalStorage = "fullCalendar";
            var opcionesDefinidas = {
                comun: {
                    slotDuration: null
                },
                dia: {},
                semana: {}
            };
            function asignarSufijoLocalStorage(sufijo){
                claveLocalStorage += ":" + sufijo;
            }
            function recuperarConfiguracionAlmacenada(){
                var string, configuracionAlmacenada;
                if( typeof JSON.parse!=="undefined" && typeof localStorage!=="undefined" ){
                    string = localStorage.getItem(claveLocalStorage);
                    if(string===null){
                        return null;
                    }
                    try{
                        configuracionAlmacenada = JSON.parse(string);
                    }catch(e){
                        localStorage.removeItem(claveLocalStorage);
                        return null;
                    }
                    if( typeof configuracionAlmacenada!=="object"){
                        return null;
                    }
                    // @todo Validar
                    return $.extend({}, configuracionAlmacenada);
                }
                else{
                    return null;
                }
            }
            function almacenarConfiguracionAlmacenada(configuracionAlmacenada){
                if( typeof JSON.stringify!=="undefined" && typeof localStorage!=="undefined" ){
                    localStorage.setItem(claveLocalStorage, JSON.stringify(configuracionAlmacenada));
                }
            }
            function guardarCambio(tipo, opcion, valor){
                var configuracionAlmacenada = recuperarConfiguracionAlmacenada();
                if(typeof opcionesDefinidas[tipo]==="undefined"){
                    throw new Error("Tipo desconocido: " + tipo);
                }
                if(configuracionAlmacenada===null){
                    configuracionAlmacenada = {};
                }
                if(typeof configuracionAlmacenada[tipo]==="undefined"){
                    configuracionAlmacenada[tipo] = {};
                }
                configuracionAlmacenada[tipo][opcion] = valor;
                almacenarConfiguracionAlmacenada(configuracionAlmacenada);
            }
            function leerOpciones(tipo, opcionesPredeterminadas){
                var configuracionAlmacenada, opciones;
                if(typeof opcionesDefinidas[tipo]==="undefined"){
                    throw new Error("Tipo desconocido: " + tipo);
                }
                configuracionAlmacenada = recuperarConfiguracionAlmacenada();
                if(configuracionAlmacenada===null){
                    return opcionesPredeterminadas;
                }
                opciones = $.extend({}, opcionesPredeterminadas, configuracionAlmacenada["comun"], configuracionAlmacenada[tipo]);
                return opciones;
            }
            return {
                asignarSufijoLocalStorage: asignarSufijoLocalStorage,
                leerOpciones: leerOpciones,
                guardarCambio: guardarCambio
            };
        })();
        function tamanoRanura($calendario, minutos){
            var tamanos = {
                "1" : "00:01:00",
                "5" : "00:05:00",
                "15": "00:15:00",
                "30": "00:30:00",
                "60": "01:00:00"
            };
            if(typeof tamanos[minutos]!=="undefined"){
                $calendario.fullCalendar("option", "slotDuration", tamanos[minutos]);
                marcarBotonTamanoRanuraPulsado($calendario, tamanos[minutos]);
                ConfiguracionPersistente.guardarCambio("comun", "slotDuration", tamanos[minutos]);
            }
        }
        function marcarBotonTamanoRanuraPulsado($calendario, slotDuration){
            var tamanos = {
                "00:01:00": ".fc-ranura1min-button",
                "00:05:00": ".fc-ranura5min-button",
                "00:15:00": ".fc-ranura15min-button",
                "00:30:00": ".fc-ranura30min-button",
                "01:00:00": ".fc-ranura60min-button"
            };
            var clasesBotones = [];
            if(typeof tamanos[slotDuration]!=="undefined"){
                selectorTodos = $.map(tamanos, function(clase){
                    clasesBotones.push(clase);
                });
            }
            $calendario
                .find(clasesBotones.join(","))
                .removeClass("pulsado")
                .filter(tamanos[slotDuration])
                .addClass("pulsado");
            ;
        }
        var f=new Date();
        var minutes = 0;
        if(f.getMinutes() > 30)
        {
            minutes = 3;
        }
        horaActual = f.getHours()+":"+minutes+"0:00";
        var opciones = {
            locale: 'es',
            firstDay: 1, // Lunes
            customButtons: {
                ranura5min: {
                    text: "5",
                    click: function(){
                        tamanoRanura($(this).closest(".fc"), 5);
                    }
                },
                ranura15min: {
                    text: "15",
                    click: function(){
                        tamanoRanura($(this).closest(".fc"), 15);
                    }
                },
                ranura30min: {
                    text: "30",
                    click: function(){
                        tamanoRanura($(this).closest(".fc"), 30);
                    }
                },
                ranura60min: {
                    text: "60",
                    click: function(){
                        tamanoRanura($(this).closest(".fc"), 60);
                    }
                },
                nuevaTarea: {
                    text: $(".calendario-dia-js") !== undefined ? $(".calendario-dia-js").data('text') : "Nueva tarea",
                    click: function(){
                        $("#ModalOperarios").foundation('reveal', 'open', '/operarios/dialogo_nueva_tarea');
                    }
                }
            },
            // El formato indicado en el diseño sería este:
            //     titleFormat: "dddd, LL"
            // Lamentablemente no funciona por un bug en la librería: https://github.com/fullcalendar/fullcalendar/issues/3645
            titleFormat: "LL",
            header: {
                left: "ranura5min,ranura15min,ranura30min,ranura60min",
                center: "prev,title,next",
                right: "nuevaTarea"
            },
            allDaySlot: false,
            slotLabelFormat: 'H:mm',
            slotEventOverlap: false,
            slotDuration: "00:15:00",
            defaultTimedEventDuration: '00:10:00', // Duración aparente de los eventos sin hora de finalización
            minTime: '07:00:00',
            scrollTime: horaActual,
            eventRender: function(event, element/*, view*/){
                var datos = event.datosAdicionales || {};
                var $extra = $("<span></span>").addClass("extra");
                var $duracion;

                if(datos.duracion){
                    $duracion = $("<span></span>").addClass("duracion").text(datos.duracion);
                    if(datos.cronometro){
                        $duracion.addClass("cronometro-js").attr("data-inicio", event.start.format());
                    }
                    $extra.append($duracion);
                }
                if(datos.estado){
                    $extra.append($("<span></span>").addClass("estado").text(datos.estado));
                }
                if($extra.children().length){
                    element.append($extra);
                }
            },
            eventAfterAllRender: function(event, element/*, view*/){
                cargarDivAmpliableFullCalendar();
            },
            eventMouseover: function(event, jsEvent, view){
                var datos = event.datosAdicionales || {};
                if(datos.url_modal){
                    $(this).css('cursor', 'pointer');
                }
                if(datos.tooltip){
                    $(this).attr('title', datos.tooltip);
                }
            },
            eventMouseout: function(event, jsEvent, view){
                $(this).css('cursor', 'default');
                $(this).removeAttr('title');
            },
            eventClick: function(event, jsEvent, view){
                var datos = event.datosAdicionales || {};
                if(datos.url_modal){
                    $("#ModalOperarios").foundation('reveal', 'open', datos.url_modal);
                }
            },
            events: null,
            startParam: "desde",
            endParam: "hasta"
        };
        var opcionesDia = $.extend({
            defaultView: "agendaDay"
        }, opciones);
        var opcionesSemana = $.extend({
            defaultView: "agendaWeek"
        }, opciones);
        $(".calendario-dia-js").each(function(){
            var $contenedor = $(this);
            var opciones = $.extend({}, opcionesDia);
            var segundosActualizacion = $contenedor.data('segundos-actualizacion');
            var hashUsuarioStorage = $contenedor.data("hash-usuario-storage");

            if(hashUsuarioStorage!=""){
                ConfiguracionPersistente.asignarSufijoLocalStorage(hashUsuarioStorage);
            }
            opciones.events = $contenedor.data('url-eventos');
            opciones = ConfiguracionPersistente.leerOpciones("dia", opciones);
            $contenedor.fullCalendar(opciones);
            marcarBotonTamanoRanuraPulsado($contenedor, opciones.slotDuration);
            if(segundosActualizacion>0){
                ActualizacionesSincronizadas.anadirTarea(function(){
                    $contenedor.fullCalendar('refetchEvents');
                }, 1000*segundosActualizacion);
            }
        });
        $(".calendario-semana-js").fullCalendar(opcionesSemana);
    };
    var cargarDivAmpliableFullCalendar = function(){
        if($('.cnt-tiles-mechanic-js').length){
            $('.fc-time-grid-event').click(function(){
                if(!$(this).hasClass('en-curso'))
                {
                    if(!$(this).hasClass('verCompleto'))
                    {
                        $('.fc-time-grid-event.verCompleto').removeClass('verCompleto');
                        $(this).addClass('verCompleto');
                    }
                    else
                    {
                        $('.fc-time-grid-event.verCompleto').removeClass('verCompleto');
                    }
                }
            });
        }
    };
    var cargarRelojes = function(){
        // Intervalo entre refrescos (milisegundos)
        // Cuanto menor sea menor es el desfase y peor el rendimiento (o no funciona en absoluto)
        var intervaloActualizacion = 1000;
        /**
         * @param {string[]} iniciosISO8601 Fechas/horas de inicio en formato ISO-8601
         * @param {number} segundosExtra Segundos adicionales para sumar
         * @return {object} Objeto duration de la librería Moment.js
         */
        function calcularDuracionTotal(iniciosISO8601, segundosExtra){
            var duracion = moment.duration(), i;
            segundosExtra = segundosExtra || 0;

            if(segundosExtra!=0){
                duracion.add(segundosExtra, "seconds");
            }

            for(i=0; i<iniciosISO8601.length; i++){
                duracion.add(moment.duration(moment().diff(iniciosISO8601[i])));
            }
            return duracion;
        }
        ActualizacionesSincronizadas.anadirTarea(function(){
            $(".reloj-js, .cronometro-js").each(function(){
                var $reloj = $(this);
                var referencia;
                var horas, minutos;

                if( $reloj.hasClass("reloj-js") ){
                    referencia = moment();
                    horas = referencia.format('H');
                    minutos = referencia.format('mm');
                }else{
                    referencia = calcularDuracionTotal($reloj.data("inicio").split(","), $reloj.data("segundos-extra"));
                    horas = Math.floor(referencia.asHours());
                    minutos = moment.utc(referencia.asMilliseconds()).format("mm");
                }
                $reloj.html("" + horas + '<span class="animacion-reloj">:</span>' + minutos);
            });
        }, intervaloActualizacion);
    };
    var cargarActualizacionOrdenesAbiertas = function(){
        $(".ordenes-abiertas-js").each(function(){
            var $caja = $(this);
            var intervaloActualizacion = $caja.data("segundos-actualizacion")*1000;
            var url = $caja.data("url");

            ActualizacionesSincronizadas.anadirTarea(function(){
                var limit = $('#limit_listado').data("limit");
                let url_refresh = url + '?limit=' + limit;

                var response = $.get(url_refresh, function(datos){
                    $caja.html(datos);
                }, "html");
                response.error(function(xhr){
                    if(xhr.status == 403){
                        window.location.href = '/usuarios/login';
                    }
                });
                cargar_menu_operaciones(limit);
            }, intervaloActualizacion);
        });

        $("#lista-ordenes-abiertas-js").on('click', '#cargar-mas-or-js', function(event){
            var url = $(this).data("url");
            var limit = $(this).data("limit");
            $('#animacion-cargando-js').show();
            $('#cargar-mas-or-js').hide();
            $.get(url, function(datos){
                $("#lista-ordenes-abiertas-js").html(datos);
                cargar_menu_operaciones(limit);
            }, "html");
        });
    };
    var cargarClick2Copy = function(){
        $(document).off('dblclick',"input[type='text']").on('dblclick',"input[type='text']",function(event){
            if(!$(this).val()){
                $(this).val(localStorage.getItem('clipboard'));
            }
        });
        $(".click2copy-js").each(function(){
            var id = Math.random();
            if($(this).children('span.tooltiptext').length == 0){
                $(this).append('<span class="tooltiptext" id = "' + id + '">'+$('#click_copy_text-js').data('text')+'</span>');
                $(this).data('click-id', id);
            }
        });

        $(".click2copy-js").on('click', function(event){
            event.stopImmediatePropagation();
            event.preventDefault();
            var copyText = $(this).contents().not($(this).children()).text().trim();
            localStorage.setItem('clipboard', copyText);

            //Variable temporal para copiar el texto
            var dummy = document.createElement("input");

            //Se añade al document
            document.body.appendChild(dummy);
            dummy.setAttribute("id", "dummy_id");

            //Se le añade el valor que se quiere copiar
            document.getElementById("dummy_id").value = copyText;
            dummy.select();
            //Y se copia al portapapeles
            document.execCommand("copy");

            //Cuando ya no se necesita, se borra del document
            document.body.removeChild(dummy);
            $(".tooltiptext").text($('#click_copy_text-js').data('text'));
            document.getElementById($(this).data('click-id')).textContent="Copiado";

        });

        $(".click2copy-js").on('mouseover', function(event){
            event.preventDefault();
            document.getElementById($(this).data('click-id')).textContent="Click para copiar";
        });
    };
    var cargarShowPassword = function(){
        $(".show-password-js").each(function(){
            $(this).on('click', function(){
                $('#'+$(this).data('id')).attr('type', 'text');
            });
        });
    };

    let cargarCentrosMecanico = function() {
        $('#selector_mecanico_js').change(function() {
            let usuario_id = $(this).val();
            if (usuario_id) {
                let data = {
                    usuario_id: usuario_id
                };

                PeticionAjax.mostrarCargando();
                // Realizar la llamada AJAX
                $.post('/usuarios/ajaxObtenerCentrosEmpleado', data)
                    .done(function(data) {

                        let resultado = JSON.parse(data);
                        // Suponiendo que 'data' es un array de objetos con 'id' y 'nombre'
                        let selector = $('#selector_centro_empleado_js');
                        selector.empty(); // Vacía el desplegable
                        if (Object.keys(resultado).length > 1){
                            selector.append(
                                $("<option></option>").val('').text(selector.data('opcion'))
                            );
                        }
                        $.each(resultado, function(index, item) {
                            selector.append('<option value="' + index + '">' + item + '</option>');
                        });
                    })
                    PeticionAjax.ocultarCargando();
                }
        });
     };

    return {
        load: function($context){
            cargarDatepicker();
            cargarTimepicker();
            cargarDateAutocomplete();
            cargarFullCalendar();
            cargarRelojes();
            cargarActualizacionOrdenesAbiertas();
            cargarClick2Copy();
            cargarShowPassword();
            cargarCentrosMecanico();
        },
        cargarDatepicker: function($context){
            cargarDatepicker();
        },
        cargarTimepicker: function($context){
            cargarTimepicker();
        },
        cargarClick2Copy: function($context){
            cargarClick2Copy();
        },
        cargarCentrosMecanico: function($context){
            cargarCentrosMecanico();
        }
    }
})();
var DivHelper  = (function(){

    var onClickShowDiv = function($item, $div){
        $item.click(function(){
            _mostrar($div);
        });
    };
    var onClickHideDiv = function($item, $div){
        $item.click(function(){
            _ocultar($div);
        });
    };
    var onClickShowHide = function(){
        $('.on-click-show-hide-js').click(function(event){
            event.preventDefault();
            var $div = $($(this).data('div'));
            if($div.is(':visible')){
                _ocultar($div);
            }else{
                _mostrar($div);
            }
        });
    };
    var _mostrar = function($item){
        $item.show();
    };
    var _ocultar = function($item){
        $item.hide();
    };
    var eliminarDivPadre = function(){
        $('.div-con-mensaje-js').on('click', 'a.eliminar_div_padre', function(event){    // Como se crea dinámicamente, el evento de captura desde un elemento superior presente siempre.
            $(this).parent().parent().remove();
        });
    };
    return {
        load: function(){
            onClickShowHide();
            eliminarDivPadre();
        },
        onClickShowDiv: function($item, $div){
            onClickShowDiv($item, $div);
        },
        onClickHideDiv: function($item, $div){
            onClickHideDiv($item, $div);
        }
    }
})();
var FormHelper  = (function(){

    var cargarEdicionColor = function () {
        $(".cambiar-color-js").spectrum({
            allowEmpty: true,
            chooseText: $('#messages_text-js').data('text_seleccionar'),
            cancelText: $('#messages_text-js').data('text_cancelar'),
            showInput: true,
            className: "full-spectrum",
            showInitial: true,
            showPalette: true,
            showSelectionPalette: true,
            maxSelectionSize: 10,
            preferredFormat: "hex",
            localStorageKey: "spectrum.demo",
            move: function (color) {
                cambiarColorVehiculo(color.toHexString());
            },
            show: function () {

            },
            beforeShow: function () {

            },
            hide: function () {

            },
            change: function (color) {
                cambiarColorVehiculo(color.toHexString());
            },
            palette: [
                ["rgb(0, 0, 0)", "rgb(67, 67, 67)", "rgb(102, 102, 102)",
                    "rgb(204, 204, 204)", "rgb(217, 217, 217)", "rgb(255, 255, 255)"],
                ["rgb(152, 0, 0)", "rgb(255, 0, 0)", "rgb(255, 153, 0)", "rgb(255, 255, 0)", "rgb(0, 255, 0)",
                    "rgb(0, 255, 255)", "rgb(74, 134, 232)", "rgb(0, 0, 255)", "rgb(153, 0, 255)", "rgb(255, 0, 255)"],
                ["rgb(230, 184, 175)", "rgb(244, 204, 204)", "rgb(252, 229, 205)", "rgb(255, 242, 204)", "rgb(217, 234, 211)",
                    "rgb(208, 224, 227)", "rgb(201, 218, 248)", "rgb(207, 226, 243)", "rgb(217, 210, 233)", "rgb(234, 209, 220)",
                    "rgb(221, 126, 107)", "rgb(234, 153, 153)", "rgb(249, 203, 156)", "rgb(255, 229, 153)", "rgb(182, 215, 168)",
                    "rgb(162, 196, 201)", "rgb(164, 194, 244)", "rgb(159, 197, 232)", "rgb(180, 167, 214)", "rgb(213, 166, 189)",
                    "rgb(204, 65, 37)", "rgb(224, 102, 102)", "rgb(246, 178, 107)", "rgb(255, 217, 102)", "rgb(147, 196, 125)",
                    "rgb(118, 165, 175)", "rgb(109, 158, 235)", "rgb(111, 168, 220)", "rgb(142, 124, 195)", "rgb(194, 123, 160)",
                    "rgb(166, 28, 0)", "rgb(204, 0, 0)", "rgb(230, 145, 56)", "rgb(241, 194, 50)", "rgb(106, 168, 79)",
                    "rgb(69, 129, 142)", "rgb(60, 120, 216)", "rgb(61, 133, 198)", "rgb(103, 78, 167)", "rgb(166, 77, 121)",
                    "rgb(91, 15, 0)", "rgb(102, 0, 0)", "rgb(120, 63, 4)", "rgb(127, 96, 0)", "rgb(39, 78, 19)",
                    "rgb(12, 52, 61)", "rgb(28, 69, 135)", "rgb(7, 55, 99)", "rgb(32, 18, 77)", "rgb(76, 17, 48)"]
            ]
        });
    };
    var cargarMostrarCargandoFormulario = function(){
        $('.boton-cargando-ejecutar-formulario-js').click(function(event){
            PeticionAjax.mostrarCargando();
        });
    };
    var cargarLinkConfirm = function(){
        $('.link-confirm-js').click(function(event){
            if(!confirm($(this).data('confirmmsg'))){
                event.preventDefault();
            }
        });
    };
    var deshabilitarIntro = function(){
        $(window).keydown(function(event){
            if ( event.keyCode == 13 ){
                return false;
            }
        });
    };
    var habilitarIntro = function(){
        $('.form-enter-activo-js :input').each(function(){
            $(this).keydown(function(event){
                if ( event.keyCode == 13 ){
                    $('.form-enter-activo-js').submit();
                }
            });
        });
    };
    var habilitarCampos = function(form, habilitar){
        $(form + " input," + form + " select," + form + " textarea").attr('disabled', habilitar);
    };
    var cargarSubmitFormulario = function(){
        $('.submit-form').click(function(){
            $(this).parents('form').each(function(){
                $(this).submit();
            });
        });
    };

    var albaranesPendienteAAlbaranes = function(){
        $('input[type="checkbox"].checkbox').change(function(){
            var numberChecked = $('input.count_checked:checked').length;
            var todos = $('input.count_checked').length;
            if($(this).val() == $('input.all_checked').val()){
                if($('input.all_checked').is(':checked')){
                    $('.pasar_pendientes_a_albaranes').val('Pasar a albaranes (' + todos + ')');
                }else{
                    $('.pasar_pendientes_a_albaranes').val('Pasar a albaranes (0)');
                }
            }else{
                $('.pasar_pendientes_a_albaranes').val('Pasar a albaranes (' + numberChecked + ')');
            }

            if($(this).is(':checked')){
                $('#btn_pasar_a_albaranes').removeAttr('hidden');
            }
        });
    };
    var cargarTodosCheckBox = function(){
        $('input[type="checkbox"].checkBoxTodos').change(function(){
            $parent = $(this).closest(".contain-all-checkboxs-js");
            if($(this).is(':checked')){
                $parent.find('input[type="checkbox"]').prop('checked', true);
            }else{
                $parent.find('input[type="checkbox"]').prop('checked', false);
            }
        });
    };
    var marcarTodosCheckBox = function(){
        $('input[type="checkbox"]#marcarTodosCheckBox0').change(function(){
            if ($(this).is(':checked')) {
                $(".marcarTodos-js input[type=checkbox]").prop('checked', true); //solo los del objeto #diasHabilitados
            } else {
                $(".marcarTodos-js input[type=checkbox]").prop('checked', false);//solo los del objeto #diasHabilitados
            }
        });
    };
    var marcarCheckBoxClase = function(){
        $('input[type="checkbox"].checkBoxClase').change(function(){
            if ($(this).is(':checked')) {
                $("input[type=checkbox].marcarTodos-js").prop('checked', true); //solo los del objeto #diasHabilitados
            } else {
                $("input[type=checkbox].marcarTodos-js").prop('checked', false);//solo los del objeto #diasHabilitados
            }
        });
    };
    
    var marcarCheckBoxClasePorId = function(){
        $('input[type="checkbox"].checkBoxClase').change(function(){
            id = $(this).data('id');
            if ($(this).is(':checked')) {
                $("input[type=checkbox].marcarTodos-" + id + "-js").prop('checked', true); //solo los del objeto #diasHabilitados
            } else {
                $("input[type=checkbox].marcarTodos-" + id + "-js").prop('checked', false);//solo los del objeto #diasHabilitados
            }
        });
    };
    var cargarLimpiarInputs = function(){
        $('.limpiar-form-js').click(function(event){
            event.preventDefault();
            $parent = $(this).closest(".contain-limpiar-form-js");
            $parent.find('input[type="text"], select, textarea').val('');
            $parent.find('span.select2-selection').text('');
        });

        $('.limpiar-form-almacen-js').click(function(event){
            event.preventDefault();
            $parent = $(this).closest(".contain-limpiar-form-js");
            $parent.find('input, select').each(function(){
                if(!$(this).is('input[type="submit"]')){
                    $(this).val('');
                }
            });
            $('#linea-detalle-marca-clear-js').click();
            $('#linea-detalle-proveedor-referencia-js').select2('val', 'All');
            $('.borrar-familia').click();
        });
    };
    var cargarDragAndDrop = function(){
        $('.dragdrop-js').each(function(){
            $(this).niceFileInput();
            var fileWrapperParent = $(this).parents('.fileWrapper:not(.fileWrapperList)');
            if($(this).hasClass('dragdrop-multiple-js')){
                fileWrapperParent.addClass('fileWrapperMultiple');
            }
            fileWrapperParent.addClass($('meta[name="language"]').attr("content"));
            $(this).next().hide();
            $(this).change(function(){
                //Comprobar tipo de fichero subido
                var propiedades = $(this).prop('files')[0];
                if($(this).attr('id') == 'tipo_icono-js' || $(this).attr('id') == 'tipo_imagen-js'){
                    let esImagen = comprobar_extensiones(propiedades['type'], ["image/jpg", "image/jpeg", "image/bmp", "image/gif", "image/png"])
                    if(!esImagen){
                        SweetAlert.cargarComportamientoSweetModal(4, 'El fichero debe ser de un tipo de imagen válido', 'Error');
                        return false;
                    }
                }
                if($(this).attr('id') == 'tipo_video-js'){
                    let esVideo = comprobar_extensiones(propiedades['type'], ["video/x-flv", "video/mp4", "video/MP2T", "video/3gpp", "video/quicktime", "video/x-msvideo", "video/x-ms-wmv"])
                    if(!esVideo){
                        SweetAlert.cargarComportamientoSweetModal(4, 'El fichero debe ser un tipo de vídeo válido', 'Error');
                        return false;
                    }
                }
                fileWrapperParent = $(this).parents('.fileWrapper:not(.fileWrapperList)');
                var fileWrapperDragDropDeleteFile = '<span class="dragdrop-delete-file-js">[x]</span>';
                if($(this).hasClass('dragdrop-multiple-js')){
                    var fileWrapperClone = fileWrapperParent.clone(true, true);
                    var fileWrapperParentInputText = fileWrapperParent.find('.fileInputText');
                    fileWrapperParentInputText.show();
                    fileWrapperParentInputText.after(fileWrapperDragDropDeleteFile);
                    fileWrapperParent.addClass('fileWrapperList');
                    $(this).parent().before(fileWrapperClone);
                    fileWrapperClone.children('input[type="file"]').val('');
                    fileWrapperClone.children('.fileInputText').val('');
                }else{
                    if(!fileWrapperParent.find('.dragdrop-delete-file-js').html()){
                        fileWrapperParent.find('.fileInputText').after(fileWrapperDragDropDeleteFile);
                        $(this).next().show();
                    }
                }
                cargarEliminarDragAndDrop();
                //setTimeout(function(){ makeSticky(); }, 1000);
            });
        });
    };

    var comprobar_extensiones = function (fileName, extensiones){
        var ext = fileName.split('.').pop();
        var correspondeExtensiones = false;
        extensiones.forEach(function(element) {
            if(element==ext){
                correspondeExtensiones=true;
            }
        });
        return correspondeExtensiones;
    };

    var cargarEliminarDragAndDrop = function(){
        $('.dragdrop-delete-file-js').click(function(){
            $fileWrapperParent = $(this).parents('.fileWrapper');
            if($fileWrapperParent.hasClass('fileWrapperList')){
                $fileWrapperParent.remove();
            }else{
                $fileWrapperParent.find('input[type="file"]').val('');
                $fileWrapperParent.find('.fileInputText').val('');
                $(this).parent().find('.fileInputText').hide();
                $(this).remove();
            }
        });
    };
    var removeEmptyInputFile = function(){
        $('.fileWrapperMultiple.fileWrapper').each(function(){
            if($('.fileWrapperMultiple.fileWrapper').length > 1){
                if(!$(this).hasClass('fileWrapperList')){
                    $(this).remove();
                }
            }
        });
    }

    var cargarDatosSelect = function(){
        $('.cargar-datos-select-js').click(function(){
            let $select = $(this);
            if($select.find('option').length == 0){
                $select.empty().append("<option></option>");

                PeticionAjax.mostrarCargando();
                var request = PeticionAjax.get($select.data('url'));
                request.done(function(res) {
                    PeticionAjax.ocultarCargando();
                    var resultado = JSON.parse(res);
                    if(resultado.datos){
                        $.each(resultado.datos, function(clave, valor){
                            $select.append(
                                $("<option></option>").val(clave).text(valor)
                            );
                        });
                    }
                });
            }
        });
    }

    // Por ejemplo para cargar poblaciones en base a la provincia seleccionada.
    var cargarSelectsEnlazados = function(){
        $("select.selector-enlazado").each(function(){
            var $selectPadre = $(this);
            var $selectHijo = $($selectPadre.data("selector-hijo"));
            var valorSelectPadre =  $selectPadre.find(":selected").val();
            //$selectHijo.prop("disabled", valorSelectPadre=="").trigger("liszt:updated");
            $selectPadre.change(function(){
                var provinciaId = $selectPadre.find(":selected").val();
                if(provinciaId==valorSelectPadre){
                    return;
                }
                else{
                    valorSelectPadre = provinciaId;
                }
                $selectHijo.empty().prop("disabled", false).trigger("liszt:updated");
                if(provinciaId==""){
                    $selectHijo.empty().prop("disabled", true).trigger("liszt:updated");
                }
                else{
                    $.ajax({
                        dataType: "json",
                        url: $selectPadre.data("url"),
                        data: {
                            id: $selectPadre.val(),
                            fecha:$('#filtro-fecha-js').val()
                        },
                        cache: false,
                        success: function(data){
                            $selectHijo.empty().append("<option></option>");
                            $.each(data, function(clave, valor){
                                $selectHijo.append(
                                    $("<option></option>").val(clave).text(valor)
                                );
                            });
                            $selectHijo.select2({
                                sorter: data => data.sort((a, b) => a.text.localeCompare(b.text)),
                            });
                        }
                    });
                }
            });
        });

        $("select.selector-enlazado-acuerdo").each(function(){
            var $selectPadre = $(this);
            var $selectHijo = $($selectPadre.data("selector-hijo"));
            var valorSelectPadre =  $selectPadre.find(":selected").val();
            $selectPadre.change(function(){
                var provinciaId = $selectPadre.find(":selected").val();
                if(provinciaId==valorSelectPadre){
                    return;
                }
                else{
                    valorSelectPadre = provinciaId;
                }
                // $selectHijo.empty().prop("disabled", false).trigger("liszt:updated");
                if(provinciaId==""){
                    // $selectHijo.empty().prop("disabled", true).trigger("liszt:updated");
                }
                else{
                    $.ajax({
                        dataType: "json",
                        url: $selectPadre.data("url"),
                        data: {
                            id: $selectPadre.val(),
                            vehiculo_id:$selectPadre.data('vehiculo-id')
                        },
                        cache: false,
                        success: function(data){
                            // $selectHijo.empty().append("<option></option>");
                            $.each(data, function(clave, valor){
                                $selectHijo.append(
                                    $("<option></option>").val(clave).text(valor)
                                );
                            });
                        }
                    });
                }
            });
        });

        $("select.selector-enlazado-pais").each(function(){
            var $selectPadre = $(this);
            var $selectHijo = $($selectPadre.data("selector-hijo"));
            var valorSelectPadre =  $selectPadre.find(":selected").val();
            //$selectHijo.prop("disabled", valorSelectPadre=="").trigger("liszt:updated");
            $selectPadre.change(function(){
                var provinciaId = $selectPadre.find(":selected").val();
                if(provinciaId==valorSelectPadre){
                    return;
                }
                else{
                    valorSelectPadre = provinciaId;
                }
                $selectHijo.empty().prop("disabled", false).trigger("liszt:updated");
                if(provinciaId==""){
                    $selectHijo.empty().prop("disabled", true).trigger("liszt:updated");
                }
                else{
                    $.ajax({
                        dataType: "json",
                        url: $selectPadre.data("url"),
                        data: {
                            id: $selectPadre.val(),
                            fecha:$('#filtro-fecha-js').val()
                        },
                        cache: false,
                        success: function(data){
                            if(data){
                                // Mostrar desplegables de provincia y población
                                $('#div-texto-poblacion-provincia-js').hide();
                                $('#div-texto-poblacion-provincia-js-df').hide(); // Form datos facturación cliente
                                $('#div-select-poblacion-provincia-js').show();
                                $('#div-select-poblacion-provincia-js-df').show(); // Form datos facturación cliente

                                $selectHijo.empty().append("<option></option>");
                                $.each(data, function(clave, valor){
                                    $selectHijo.append(
                                        $("<option></option>").val(clave).text(valor)
                                    );
                                });
                            }else{
                                // Mostrar campos de texto de provincia y población
                                $('#div-texto-poblacion-provincia-js').show();
                                $('#div-texto-poblacion-provincia-js-df').show(); // Form datos facturación cliente
                                $('#div-select-poblacion-provincia-js').hide();
                                $('#div-select-poblacion-provincia-js-df').hide(); // Form datos facturación cliente
                            }
                        }
                    });
                }
            });
        });
    };

    var pasar_parametros_formulario_a_otro_listado = function(){
        $('.boton-ver-mas-listado-js').click(function(event){
            event.preventDefault();
            var $valor_js = $(this);
            var id_form = $valor_js.data('id-form');
            var url = $valor_js.data('url');
            var cadena = $(id_form).serialize();
            if(cadena != ''){
                window.location.href = url+'?'+cadena;
            }
            else{
                window.location.href = url;
            }
        });
    };
    var corregirDecimalPuntoPorComa = function(){
        $('.decimal-coma-js').keyup(function (){
            $campo_input_decimal = $(this);
            // Mostrar siempre en el campo la ','
            $campo_input_decimal.val($campo_input_decimal.val().replace('.',','));
            // Si el primer caracter el campo es una ',', se pone el cero delante para que después no dé un mensaje de error en las validaciones de CakePHP
            if ($campo_input_decimal.val().substring(0, 1) == ','){
                $campo_input_decimal.val('0' + $campo_input_decimal.val());
            }
        })
    };
    var permitirSoloNumeros = function(){
        $(".solo-numeros-js").keydown(function (e) {
            // Allow: backspace, delete, tab, escape, enter and .
            if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 110, 190, 109, 173, 189]) !== -1 ||
                    // Allow: Ctrl/cmd+A
                (e.keyCode == 65 && (e.ctrlKey === true || e.metaKey === true)) ||
                    // Allow: Ctrl/cmd+C
                (e.keyCode == 67 && (e.ctrlKey === true || e.metaKey === true)) ||
                    // Allow: Ctrl/cmd+X
                (e.keyCode == 88 && (e.ctrlKey === true || e.metaKey === true)) ||
                    // Allow: home, end, left, right
                (e.keyCode >= 35 && e.keyCode <= 39)) {
                // let it happen, don't do anything
                return;
            }
            // Ensure that it is a number and stop the keypress
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        })
    };
    var permitirSoloNumerosPositivos = function(){
        $(".solo-numeros-positivos-js").keydown(function (e) {
            if (e.keyCode == 109 || e.keyCode == 189) {
                e.preventDefault();
            }
        })
    };

    var permitirSoloNumerosNegativos = function(){
        $('.solo-numeros-negativos-js').on('input', function() {

            if ($('#tipo-factura-abono-js').val() == 2) { // facturas abono
                let valor = $(this).val();
                // Reemplazar puntos por comas
                valor = valor.replace(/\./g, ','); // Reemplaza puntos por comas
                // Si el valor es solo un guion y se va a agregar un punto, lo cambiamos a '-0,'
                if (valor === '-') {
                    $(this).val('-');
                    return; // Salimos para no seguir modificando el valor
                }
                // Si el valor tiene un '-' al principio y el siguiente carácter es un punto, agregar '0' antes de la coma
                if (valor.startsWith('-') && valor.length === 2 && valor[1] === ',') {
                    $(this).val('-0,');
                    return; // Salir para evitar cambios adicionales
                }
                // Si el valor no empieza con un guion, lo añadimos y quitamos cualquier otro carácter que no sea numérico o coma
                if (!valor.startsWith('-')) {
                    $(this).val('-' + valor.replace(/[^0-9,]/g, ''));
                } else {
                    // Si ya empieza con un guion, quitamos cualquier carácter que no sea numérico o coma
                    $(this).val('-' + valor.slice(1).replace(/[^0-9,]/g, ''));
                }

                // Si el campo se queda vacío o solo con el signo negativo, asignamos '-'
                if ($(this).val() === '' || $(this).val() === '-') {
                    $(this).val('-');
                }
            }
        });

        $('.solo-numeros-negativos-js').on('blur', function() {
            if ($('#tipo-factura-abono-js').val() == 2) { // facturas abono
                let valor = $(this).val();

                if (valor === '' || valor === '-') {
                    $(this).val('-');
                }
            }
 
        });
    };

    // Ejemlo alert
    var cargarMensajeAlert = function(){
        $('.lanzar-mensaje-sweet-alert-js').click(function(event){
            event.preventDefault();
            var $datos_js = $(this);
            var titulo = $datos_js.data('titulo');
            var mensaje = $datos_js.data('mensaje');
            var tipo = $datos_js.data('tipo');
            if(tipo == undefined || tipo == ''){
                tipo = 1;
            }
            SweetAlert.cargarComportamientoSweetModal(tipo,mensaje,titulo);
        });
    };
    var cargarCheckall = function(){
        $(".check-all-js").change(function() {
            var checkboxes = $(this).closest('form').find(':checkbox');
            checkboxes.prop('checked', $(this).is(':checked'));
        });
        $(".check-all-div-js").change(function() {
            var checkboxes = $(this).closest('.div-checks').find(':checkbox');
            checkboxes.prop('checked', $(this).is(':checked'));
        });
    };
    var cargarSaltoLineaTextarea = function(){
        $('.textarea-salto-linea-js').keydown(function(event){
            if (event.which === 13 && !event.shiftKey) {
                event.preventDefault();
                var text = $(this).val();
                text = text + '\n';
                $(this).val(text);
              }
        });
    };
    var ocultarBotonClick = function(){
        $('.ocultar-boton-click').click(function(event){
            $(this).hide();
        });
    };
    return {
        load: function(){
            cargarEdicionColor();
            cargarSubmitFormulario();
            cargarTodosCheckBox();
            albaranesPendienteAAlbaranes();
            marcarTodosCheckBox();
            marcarCheckBoxClase();
            marcarCheckBoxClasePorId();
            cargarLimpiarInputs();
            cargarLinkConfirm();
            cargarDragAndDrop();
            cargarDatosSelect();
            cargarSelectsEnlazados();
            cargarMostrarCargandoFormulario();
            //cargarSelectsEnlazadosVehiculos();
            //cargarSelectsEnlazadosVehiculos2();
            //cargarSelectsEnlazadosMarcasModelosVersionesPropiasVehiculos();
            pasar_parametros_formulario_a_otro_listado();
            corregirDecimalPuntoPorComa();
            permitirSoloNumeros();
            permitirSoloNumerosPositivos();
            permitirSoloNumerosNegativos();
            cargarMensajeAlert();
            cargarCheckall();
            cargarSaltoLineaTextarea();
            ocultarBotonClick();
            SelectorLineasManoObraParaTiempos.init();
        },
        deshabilitarIntro: function(){
            deshabilitarIntro();
        },
        habilitarIntro: function(){
            habilitarIntro();
        },
        habilitarCampos: function(form, habilitar){
            habilitarCampos(form, habilitar);
        },
        cargarTodosCheckBox: function(){
            cargarTodosCheckBox();
        },
        albaranesPendienteAAlbaranes: function(){
            albaranesPendienteAAlbaranes();
        },
        marcarTodosCheckBox: function(){
            marcarTodosCheckBox();
        },
        corregirDecimalPuntoPorComa: function(){
            corregirDecimalPuntoPorComa();
        },
        permitirSoloNumeros: function(){
            permitirSoloNumeros();
        },
        permitirSoloNumerosPositivos: function(){
            permitirSoloNumerosPositivos();
        },
        permitirSoloNumerosNegativos: function(){
            permitirSoloNumerosNegativos();
        },
        cargarMensajeAlert: function(){
            cargarMensajeAlert();
        },
        cargarSelectsEnlazados: function(){
            cargarSelectsEnlazados();
        },
        cargarMostrarCargandoFormulario: function(){
            cargarMostrarCargandoFormulario();
        },
        cargarEdicionColor: function () {
            cargarEdicionColor();
        },
        ocultarBotonClick: function(){
            ocultarBotonClick();
        },
        cargarDragAndDrop: function () {
            cargarDragAndDrop();
        },
        cargarDatosSelect: function () {
            cargarDatosSelect();
        },
    }
})();
var Tools  = (function(){
    var cargarComportamientoTableTrLink = function(){
        $('tr.link-js td').click(function(){
            if(!$(this).hasClass('no-link-js')){
                window.location = $(this).parent('tr').data('url');
            }
        });
    };
    var mostrarOcultarOrCal = function(){
        $('.mostrar-cal-me').click(function(e){
            e.preventDefault();
            $(this).addClass('active');
            $('.mostrar-or-me').removeClass('active');
            $('.motrar-ordenes-me').hide();
            $('.motrar-calendario-me').css({'position':'static', 'left':'auto', 'top':'auto'});
            $('.motrar-calendario-me').show();
        });
        $('.mostrar-or-me').click(function(e){
            e.preventDefault();
            $(this).addClass('active');
            $('.mostrar-cal-me').removeClass('active');
            $('.motrar-ordenes-me').show();
            $('.motrar-calendario-me').hide();
        });
    };

    var controlMenusRWD = function(){
        let resizeTimer;
        $(window).on('resize', function(e) {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if(document.body.clientWidth <= 1000)
                {
                    $('#container').addClass('close-operations-menu');
                }
                else if($.cookie('columnaCochesAbierta') == 1)
                {
                    $('#container').removeClass('close-operations-menu');
                }
                if(document.body.clientWidth <= 1000)
                {
                    $('#container').addClass('close-column-right');
                }
                else if($.cookie('menuDerAbierto') == 1)
                {
                    $('#container').removeClass('close-column-right');
                }
            }, 500);

        });
    };

    var columnaCoches = function(){
        if($.cookie('columnaCochesAbierta') == 2 || document.body.clientWidth <= 1000)
        {
            // cerrarColumnsCochesInstantaneo();
            $('#container').addClass('close-operations-menu');
        }
        $('.close-menu-operaciones').click(function(event)
        {
            event.preventDefault();
            // $('#container').toggleClass('close-operations-menu');
            if($('#container').hasClass('close-operations-menu'))
            {
                $.cookie('columnaCochesAbierta', 1, { path: '/' });
                $('#container').removeClass('close-operations-menu');
                cargar_menu_operaciones();
                // cerrarColumnsCoches();
            }
            else
            {
                $.cookie('columnaCochesAbierta', 2, { path: '/' });
                $('#container').addClass('close-operations-menu');
                // abrirColumnsCoches();
            }
        });
    };

    var barraInfoSuperior = function(){
        if($.cookie('barraSuperiorInfo') == 1 && $.cookie('rightPanels6') != 2)
        {
            $('.cnt-menu-superior').show();
        }
        else if ($.cookie('barraSuperiorInfo') != 1 && $.cookie('rightPanels6') == 2)
        {
            $('.cnt-menu-superior').hide();
        }
        $('.close-menu-operaciones').click(function(event)
        {
            event.preventDefault();
            if($.cookie('columnaCochesAbierta') == 1 || $.cookie('botonVehiculoCliente') == 1 || $.cookie('rightPanels6') == 2)
            {
                //if($.cookie('rightPanels6') == 2){
                    $.cookie('barraSuperiorInfo', 2, { path: '/' });
                    $('.cnt-menu-superior').hide();
                //}
            }
            else if($.cookie('columnaCochesAbierta') == 2 && $.cookie('botonVehiculoCliente') == 2)
            {
                if($.cookie('rightPanels6') != 2){
                    $.cookie('barraSuperiorInfo', 1, { path: '/' });
                    $('.cnt-menu-superior').show();
                }
            }
        });
    };

    var mainMenu = function(){
        setTimeout(function(){abrirColumnsDerecha();},500);
        $('.abrir-menu-principal').click(function(event)
        {
            event.preventDefault();
            if($('#container').hasClass('close-main-menu'))
            {
                $.cookie('menuAbierto', 1, { path: '/' });
                $('#container').removeClass('close-main-menu');
            }
            else
            {
                $.cookie('menuAbierto', 2, { path: '/' });
                $('#container').addClass('close-main-menu');
            }
        });
    };
    var cerrarColumna = function(){
        // if($.cookie('menuDerAbierto') == 2) { setTimeout(function(){$('.cerrar-columna-js').click();},500); }
        setTimeout(function(){abrirColumnsDerecha();},500);
        if($.cookie('menuDerAbierto') == 2 || document.body.clientWidth <= 1000)
        {
            // cerrarColumnsCochesInstantaneo();
            $('#container').addClass('close-column-right');
        }
        $('.cerrar-columna-js').click(function(event)
        {
            event.preventDefault();
            // $('#container').toggleClass('close-operations-menu');
            if($('#container').hasClass('close-column-right'))
            {
                $.cookie('menuDerAbierto', 1, { path: '/' });
                $('#container').removeClass('close-column-right');
                // cerrarColumnsCoches();
            }
            else
            {
                $.cookie('menuDerAbierto', 2, { path: '/' });
                $('#container').addClass('close-column-right');
                // abrirColumnsCoches();
            }

            // if($('.mo-columna').hasClass('ocultarC'))
            // {
            //     $.cookie('menuDerAbierto', 2, { path: '/' });
            //     cerrarColumnsDerecha();
            // }
            // else
            // {
            //     $.cookie('menuDerAbierto', 1, { path: '/' });
            //     abrirColumnsDerecha();
            // }
        });
    };
    //var estadoChequeo = function(){
    //    var chequeo_estado = $('.cnt-link-chequeo').find('.estado-chequeo-clic-js');
    //    var valor_chequeo_estado = 1;
    //    if($(chequeo_estado).length){
    //        valor_chequeo_estado = $(chequeo_estado).data('valor-contrario');
    //    }
    //    var cooki_estado = $.cookie('ChequeoEstado');
    //    console.log('cooki edo: '+cooki_estado);
    //    console.log('edo: '+valor_chequeo_estado);
    //    if(cooki_estado+"" != valor_chequeo_estado+"")
    //    {
    //        console.log('clic conservar estado');
    //        //$('.estado-chequeo-clic-js').click();
    //        $('.estado-clic-js').click();
    //    }
    //};
    //var cerrarColumnsDerecha = function() {
    //    $('.cerrar-columna-js > span').fadeOut(500);
    //    $('.columna-encoger .ce-ocultar').fadeOut(500, function(){
    //        $('.cerrar-columna-js > span').fadeIn(500);
    //        $('.cerrar-columna-js > span').removeClass('ocultarC');
    //        $('.cerrar-columna-js > span').addClass('mostrarC');
    //
    //        $('.columna-encoger').removeClass('medium-4');
    //        $('.columna-encoger').addClass('columna-comprimida');
    //
    //        $('.columna-ensanchar').addClass('medium-12');
    //        $('.columna-ensanchar').removeClass('medium-8');
    //    });
    //};
    //var abrirColumnsDerecha = function() {
    //    $('.cerrar-columna-js > span').fadeOut(250, function(){
    //        $('.cerrar-columna-js > span').addClass('ocultarC');
    //        $('.cerrar-columna-js > span').removeClass('mostrarC');
    //
    //        $('.columna-encoger').addClass('medium-4');
    //        $('.columna-encoger').removeClass('columna-comprimida');
    //
    //        $('.columna-ensanchar').removeClass('medium-12');
    //        $('.columna-ensanchar').addClass('medium-8');
    //
    //        $('.cerrar-columna-js > span').delay(500).fadeIn(500);
    //        $('.columna-encoger .ce-ocultar').delay(500).fadeIn(500);
    //    });
    //};

    var cerrarColumnsCochesInstantaneo = function() {
        $('#botones_menu-operaciones-js, .cnt-menu-operaciones').css({left: '-120px'});
        $('.close-menu-operaciones').css({left: '0'});
        $('span.close-menu-operaciones').addClass('CCC');
        $('.cont-general').css({paddingLeft: '0'});
        $('footer#main-footer').addClass('ensancho');
    };
    var cerrarColumnsCoches = function() {
        $('#botones_menu-operaciones-js, .cnt-menu-operaciones').animate({left: '-120px'}, 750, 'linear');
        $('.close-menu-operaciones').animate({left: '0'}, 750, 'linear');
        $('span.close-menu-operaciones').addClass('CCC');
        $('.cont-general').animate({paddingLeft: '0'}, 750, 'linear');
        $('footer#main-footer').addClass('ensancho');
    };
    var abrirColumnsCoches = function() {
        $('#botones_menu-operaciones-js, .cnt-menu-operaciones').animate({left: '0'}, 750, 'linear');
        $('.close-menu-operaciones').animate({left: '120px'}, 750, 'linear');
        $('span.close-menu-operaciones').removeClass('CCC');
        $('.cont-general').animate({paddingLeft: '120px'}, 750, 'linear');
        $('footer#main-footer').removeClass('ensancho');
    };

    var cerrarColumnsDerecha = function()
    {
        $('.cerrar-columna-js > span').fadeOut(500,function(){});
        $('.columna-encoger').fadeOut(500, function(){
            $('.cerrar-columna-js > span').fadeIn(500);
            $('.cerrar-columna-js > span').removeClass('ocultarC');
            // $('.cerrar-columna-js > span').addClass('mostrarC');
            // $('.columna-encoger').removeClass('medium-4');
            // $('.columna-encoger').addClass('columna-comprimida');
            // $('.columna-ensanchar').addClass('medium-12');
            // $('.columna-ensanchar').removeClass('medium-8');
            Accion.cargar();
        });
    };
    var abrirColumnsDerecha = function() {
        // $('.cerrar-columna-js > span').fadeOut(250, function(){
        //     $('.cerrar-columna-js > span').addClass('ocultarC');
        //     $('.cerrar-columna-js > span').removeClass('mostrarC');
        //     // $('.columna-encoger').addClass('medium-4');
        //     // $('.columna-encoger').removeClass('columna-comprimida');
        //     // $('.columna-ensanchar').removeClass('medium-12');
        //     // $('.columna-ensanchar').addClass('medium-8');
        //     $('.cerrar-columna-js > span').delay(500).fadeIn(500);
        //     $('.columna-encoger').delay(500).fadeIn(500,function(){
        //         Accion.cargar();
        //     });
        // });
    };
    // var impresoraFlotante = function(){
    //     $('.cnt-button-print-js').mouseenter(function(){
    //         $('.cnt-button-print-js > div').fadeIn();
    //         $('.cnt-button-print-js > span').addClass('active');
    //     });
    //     $('.cnt-button-print-js').mouseleave(function(){
    //         $('.cnt-button-print-js > div').fadeOut();
    //         $('.cnt-button-print-js > span').removeClass('active');
    //     });
    // };
    // var enviarFlotante = function(){
    //     $('.cnt-button-send-js').mouseenter(function(){
    //         $('.cnt-button-send-js > div').fadeIn();
    //         $('.cnt-button-send-js > span').addClass('active');
    //     });
    //     $('.cnt-button-send-js').mouseleave(function(){
    //         $('.cnt-button-send-js > div').fadeOut();
    //         $('.cnt-button-send-js > span').removeClass('active');
    //     });
    // };
    var mostrarLinea = function(){
        $('.mostrarLinea').click(function(){
            if($('.'+$(this).attr('id')).css('display') == 'none')
            {
                $('.'+$(this).attr('id')).show();
                $(this).removeClass('ion-ios-arrow-down');
                $(this).addClass('ion-ios-arrow-up');
            }
            else
            {
                $('.'+$(this).attr('id')).hide();
                $(this).removeClass('ion-ios-arrow-up');
                $(this).addClass('ion-ios-arrow-down');
            }
        });
    };
    var openCloseOper = function(){
        $('.opc-oper').click(function()
        {
            $('.cnt-opc-oper').slideToggle();
            //if($(this).hasClass('ion-ios-arrow-down'))
            //{
            //    var abierto = false;
            //}
            //if(abierto == false)
            //{
            //    $(this).removeClass('ion-ios-arrow-down');
            //    $(this).addClass('ion-ios-arrow-up');
            //    $('.cnt-opc-oper').slideDown();
            //}
            //else
            //{
            //    $(this).removeClass('ion-ios-arrow-up');
            //    $(this).addClass('ion-ios-arrow-down');
            //    $('.cnt-opc-oper').slideUp();
            //}
        });
    };
    var showMoreBehaviour = function(){
        if($(".ver_mas.proveedores").height() < 100){
            $(".ver_mas-btn.proveedores").hide();
        }else{
            $(".ver_mas.proveedores").css('height', '100px');
            $(".ver_mas-btn.proveedores").show();
        }

        if($(".ver_mas.familias").height() < 100){
            $(".ver_mas-btn.familias").hide();
        }else{
            $(".ver_mas.familias").css('height', '100px');
            $(".ver_mas-btn.familias").show();
        }

        if($(".ver_mas.referencias").height() < 100){
            $(".ver_mas-btn.referencias").hide();
        }else{
            $(".ver_mas.referencias").css('height', '100px');
            $(".ver_mas-btn.referencias").show();
        }

        $(".ver_mas-btn").on('click', function (){
            var div_height = $(this).prev().height();
    
            if(div_height == 100){
                $(this).prev().css('height', 'auto').hide().slideDown("slow");
    
            }else{
                $(this).prev().animate( { height:'100px' }, { queue:false, duration:500 });
            }
        });    
    }
    var openCloseOrdenRep = function(){
        $("#contenido").on("click", ".oc-or", function(){
            var $encabezado = $(this);
            var $cuerpo = $(".cnt-oc-or[data-id-orden='" + $encabezado.data("id-orden") + "']");

            //var $flecha = $encabezado.find(".ion-ios-arrow-down, .ion-ios-arrow-up");
            //var abrir = $flecha.hasClass("ion-ios-arrow-down");
            //$(".cnt-oc-or").slideUp();
            //$(".flecha-oc").removeClass('ion-ios-arrow-up').addClass('ion-ios-arrow-down');
            if($encabezado.hasClass('cerrado'))
            {
                $encabezado.removeClass('cerrado').addClass('abierto');
                //$flecha.removeClass('ion-ios-arrow-down').addClass('ion-ios-arrow-up');
                $cuerpo.slideDown();
            }
            else
            {
                $encabezado.removeClass('abierto').addClass('cerrado');
                $cuerpo.slideUp();
            }
        });
        $("#contenido").on("click", ".div-linea-tiempo-js", function(event)
        {
            event.preventDefault();
            var $datos_js = $(this);
            var id = $datos_js.data('id');
            var accion = $datos_js.data('accion');
            if(accion == 1)
            {
                // Comprobar si existe el id, si no existe, es que no se ha 'entrado'
                if($('#detener_linea_js_'+id).length)
                {
                    $('#detener_linea_js_'+id).click();
                }
                else
                {
                    SweetAlert.cargarComportamientoSweetModal(1, $datos_js.data('mensaje'), '');
                }
            }
            else
            {
                if($('#iniciar_linea_js_'+id).length)
                {
                    $('#iniciar_linea_js_'+id).click();
                }
                else
                {
                    SweetAlert.cargarComportamientoSweetModal(1, $datos_js.data('mensaje'), '');
                }
            }
        });
        $("#contenido").on("click", ".div-alert-linea-tiempo-js", function(event){
            event.preventDefault();
            var $datos_js = $(this);
            SweetAlert.cargarComportamientoSweetModal(1, $datos_js.data('mensaje'), '');
        });
    };
    var mostrarOcultarBuscador = function(){
        $('.cnt-title-listado .icon.ion-search').click(function(){
            $(this).closest('.cnt-buscador-lateral').find('.buscador-lateral').animate({'margin-left': '0'},500);
            $(this).closest('.cnt-buscador-lateral').find('.bloquear-buscador').fadeIn();
            /*if($(this).closest('.cnt-buscador-lateral').find('.buscador-lateral').css('margin-left') == 0)
             {
             $(this).closest('.cnt-buscador-lateral').find('.buscador-lateral').animate({'margin-left': '-240px'},1000);
             }
             else
             {
             $(this).closest('.cnt-buscador-lateral').find('.buscador-lateral').animate({'margin-left': '0'},1000);
             }*/
        });
        $('.title-b-lateral .ion-close').click(function(){
            $(this).closest('.cnt-buscador-lateral').find('.buscador-lateral').animate({'margin-left': '-240px'},500);
            $(this).closest('.cnt-buscador-lateral').find('.bloquear-buscador').fadeOut();
        });
        $('.bloquear-buscador').click(function(){
            $(this).closest('.cnt-buscador-lateral').find('.buscador-lateral').animate({'margin-left': '-240px'},500);
            $(this).closest('.cnt-buscador-lateral').find('.bloquear-buscador').fadeOut();
        });
    };
    var mostrarOcultarCrearComentario = function(){
        $('.cnt-list-comments .cnt-title-listado a.btn-nuevo-listado').click(function(e){
            e.preventDefault();
            //$(this).closest('.cnt-list-comments').find('.crear-comentario').animate({'margin-left': '0'},500);
            $(this).closest('.cnt-list-comments').find('.crear-comentario').slideToggle();
            $(this).closest('.cnt-list-comments').find('.bloquear-buscador').fadeIn();
        });
        $('.cnt-list-comments .ion-close').click(function(){
            //$(this).closest('.cnt-list-comments').find('.crear-comentario').animate({'margin-left': '-240px'},500);
            $(this).closest('.cnt-list-comments').find('.crear-comentario').slideToggle();
            $(this).closest('.cnt-list-comments').find('.bloquear-buscador').fadeOut();
        });
        $('.cnt-list-comments .bloquear-buscador').click(function(){
            $(this).closest('.cnt-list-comments').find('.crear-comentario').slideToggle();
            $(this).closest('.cnt-list-comments').find('.bloquear-buscador').fadeOut();
        });
    };
    var mostrarOcultarFormulario = function(){
        $('.cnt-title-form .icon.ion-edit').click(function(){
            $(this).closest('.cnt-formulario-lateral').find('.formulario-lateral').animate({'margin-top': '0'},500);
        });
        $('.title-b-lateral .ion-close').click(function(){
            $(this).closest('.cnt-formulario-lateral').find('.formulario-lateral').animate({'margin-top': '-240px'},500);
        });
    };
    var ampliacion = function(){
        if($('.ampliar').size() > 0)
        {
            var abrir = function(elemento){
                elemento.find('.flecha').removeClass('abajo');
                elemento.find('.flecha').addClass('arriba');
                elemento.removeClass('cerrado');
                elemento.addClass('abierto');
                elemento.find('.ampliacion').slideDown();
            };
            var cerrar = function(elemento){
                elemento.find('.flecha').removeClass('arriba');
                elemento.find('.flecha').addClass('abajo');
                elemento.removeClass('abierto');
                elemento.addClass('cerrado');
                elemento.find('.ampliacion').slideUp();
            };
            $('.ampliar').each(function() {
                if($(this).hasClass('abierto'))
                {
                    $(this).find('.flecha').removeClass('abajo');
                    $(this).find('.flecha').addClass('arriba');
                }
                else{$(this).find('.ampliacion').hide();}
            });
            if($('.abrir-todos').size() > 0)
            {
                $('.abrir-todos').click(function(){
                    var padre = $(this).closest('.contenedor-ampliaciones');
                    padre.find('.ampliar').each(function() {
                        abrir($(this));
                    });
                });
            }
            if($('.cerrar-todos').size() > 0)
            {
                $('.cerrar-todos').click(function(){
                    var padre = $(this).closest('.contenedor-ampliaciones');
                    padre.find('.ampliar').each(function() {
                        cerrar($(this));
                    });
                });
            }
            $('.mostrar-ampliado').click(function(){
                var padre = $(this).closest('.ampliar');;
                if(padre.hasClass('abierto')){cerrar(padre);}else{abrir(padre);}
            });
        }
    };
    // var flechaSubir = function(){
    //     if($('#boton-subir-cabecera').size() > 0)
    //     {
    //         $('#boton-subir-cabecera').click(function(){
    //             $('html, body').animate({scrollTop: 0}, 1000);
    //         });
    //         $(window).scroll(function(){
    //             if ($(this).scrollTop() > 500) {
    //                 $('#boton-subir-cabecera').fadeIn();
    //             } else {
    //                 $('#boton-subir-cabecera').fadeOut();
    //             }
    //         });
    //     }
    // };
    var huecoMinimo = 12000000;
    var cerrarMenuClickExterno = function()
    {
        $('.barra-superior, #contenido').click(function(event)
        {
            if($('header#header').hasClass('ml-abierto'))
            {
                $.cookie('menuAbierto', 1, { path: '/' });
                $('header#header').animate({
                    width: "0"
                }, 500, function(){
                    $('header#header').addClass('ml-cerrado');
                    $('header#header').removeClass('ml-abierto');
                });
                if(huecoMenu < huecoMinimo)
                {
                    $('.contenedor-calendario.contenedor-ancho').css('padding-left', '0');
                }
                else
                {
                    $('.contenedor-ancho').animate({
                        paddingLeft: "0"
                    }, 500);
                }
            }
        });
    };
    var tableResponsive = function()
    {
        $('.table-mobile').each(function() {
            var table = $(this);
            table.find('tbody tr').each(function() {
                var tr = $(this);
                var pos = 1;
                tr.find('td').each(function() {
                    var td = $(this);
                    var data = table.find('thead tr th:nth-child('+pos+')').html();
                    var temporalDivElement = document.createElement("div");
                    temporalDivElement.innerHTML = data;
                    data = temporalDivElement.textContent || temporalDivElement.innerText || "";
                    // data = pos+' - '+ data;
                    if(td.hasClass('acciones'))
                    {
                        data = 'Acciones';
                    }
                    td.attr({'data-th': data});
                    pos++;
                });
            });
        });
    };
    var openCloseUlMenu = function()
    {
        $('aside#main-menu > ul > li > div > div, aside#main-menu > ul > li > div > a[href="javascript:void(0);"], aside#main-menu li.enlace-padre > div > div, aside#main-menu li.enlace-padre > div > a[href="javascript:void(0);"]').click(function()
        {
            $(this).parent().parent().find('> ul').slideToggle(function(){
                if($(this).css('display') == 'none')
                {
                    $(this).parent().removeClass('open');
                    $(this).parent().addClass('close');
                }
                else
                {
                    $(this).parent().removeClass('close');
                    $(this).parent().addClass('open');
                }
            });
        });
    }
    var openQuickLinks = function()
    {
        $('.oc-quick-links').click(function(event){
            $('#accesos-rapidos').toggleClass('open');
        });
    }
    var openCloseSearcherMobile = function()
    {
        $('.oc-search-mobile').click(function(event){
            $('form.header-search').toggleClass('open');
        });
    }
    var abrirMenuPrincipal = function()
    {
        // $('.abrir-menu-principal').click(function(event)
        // {
        //     event.preventDefault();
        //     $('#container').toggleClass('close-main-menu');

        //     // ----------------------
        //     if(parseInt($('header#header').css('width')) < '50')
        //     {
        //         $.cookie('menuAbierto', 2, { path: '/' });
        //         $('header#header').animate({width: "17.5rem"}, 500);
        //         $('header#header').addClass('ml-abierto');
        //         $('header#header').removeClass('ml-cerrado');
        //         if(huecoMenu > huecoMinimo) { $('.contenedor-ancho').animate({paddingLeft: "17.5rem"}, 500); }
        //     }
        //     else
        //     {
        //         $.cookie('menuAbierto', 1, { path: '/' });
        //         $('header#header').animate({
        //             width: "0"
        //         }, 500, function(){
        //             $('header#header').addClass('ml-cerrado');
        //             $('header#header').removeClass('ml-abierto');
        //         });
        //         if(huecoMenu < huecoMinimo)
        //         {
        //             $('.contenedor-calendario.contenedor-ancho').css('padding-left', '0');
        //         }
        //         else
        //         {
        //             $('.contenedor-ancho').animate({
        //                 paddingLeft: "0"
        //             }, 500);
        //         }
        //     }
        //     var mapa_transiciones = $('.mapa-areas-transiciones-js');
        //     if (mapa_transiciones.length>0){
        //         setTimeout(function () {
        //             $('.imagen-tapiz-transiciones-js > canvas').css({ 'width': $('.imagen-tapiz-transiciones-js').css('width') });
        //             $('.imagen-tapiz-transiciones-js > canvas').css({ 'height': $('.imagen-tapiz-transiciones-js').css('height') });
        //             $('.imagen-tapiz-transiciones-js > canvas').attr({ 'width': $('.imagen-tapiz-transiciones-js').css('width') });
        //             $('.imagen-tapiz-transiciones-js > canvas').attr({ 'height': $('.imagen-tapiz-transiciones-js').css('height') });
        //             $('.mapa-areas-transiciones-js').each(function () {
        //                 var $items = $(this).find("area");
        //                 $.each($items, function (indice, valor) {
        //                     var coordenadas = $(valor).attr('coords-o').split(",");
        //                     $(valor).attr('coords', coordenadas.join(','));
        //                 });
        //             });
        //             //quitar sombra fija
        //             $("area").each(function () {
        //                 var d = $(this).data('maphilight') || {};
        //                 d.alwaysOn = false;
        //                 $(this).data('maphilight', d).trigger('alwaysOn.maphilight');
        //             });
        //             Accion.cargar();//Recargar coche
        //         }, 1000);
        //     }
        // });
        // var huecoMenu = ($(window).width()-1100)/2;
        // abrirCerrarMenu(huecoMenu);
        // $( window ).resize(function() {
        //     huecoMenu = ($(window).width()-1100)/2;
        //     abrirCerrarMenu(huecoMenu);
        // });
    };
    var abrirCerrarMenu = function(huecoMenu)
    {
        if($.cookie('menuAbierto') == 1 && huecoMenu > huecoMinimo)
        {
            $('header#header').css('width', '0');
            $('header#header').addClass('ml-cerrado');
            $('header#header').removeClass('ml-abierto');
            $('.contenedor-ancho').css({'max-width': 'none', 'padding-left': '0'});
        }
        else
        {
            if($.cookie('menuAbierto') == 2 && huecoMenu > huecoMinimo)
            {
                $('header#header').css('width', '17.5rem');
                $('header#header').addClass('ml-abierto');
                $('header#header').removeClass('ml-cerrado');
                $('.contenedor-ancho').css({'max-width': 'none', 'padding-left': '17.5rem'});
            }
            else
            {
                if(huecoMenu < huecoMinimo)
                {
                    $('header#header').css('width', '0');
                    $('header#header').addClass('ml-cerrado');
                    $('header#header').removeClass('ml-abierto');
                    $('.contenedor-ancho').css({'max-width': 'none', 'padding-left': '0'});
                }
                else
                {
                    $('header#header').css('width', '17.5rem');
                    $('header#header').addClass('ml-abierto');
                    $('header#header').removeClass('ml-cerrado');
                    $('.contenedor-ancho').css({'max-width': 'none', 'padding-left': '17.5rem'});
                }
            }
        }
    };
    var mostrarMatriculas = function(){
        $('.n-vehiculos').click(function(){
            if($(this).closest('.td-n-vehiculos').find('.panel-escondido-matriculas').css('display') == 'none')
            {
                $('.panel-escondido-matriculas').slideUp();
                $(this).closest('.td-n-vehiculos').find('.panel-escondido-matriculas').slideDown();
            }
            else
            {
                $('.panel-escondido-matriculas').slideUp();
            }
        });
    };
    var abrirCerrarEnlaces = function(){
        $('li.enlace-padre > a').click(function(){
            var item = $(this).parent();
            if(item.find('.enlaces-hijos').css('display') == 'block')
            {
                item.find('> a').removeClass('abierto');
                item.find('.enlaces-hijos').slideUp('slow');
            }
            else
            {
                item.find('> a').addClass('abierto');
                item.find('.enlaces-hijos').slideDown('slow');
            }
            //item.find('.enlaces-hijos').slideToggle('slow');
            event.stopPropagation();
        });
        $('li.enlace-padre-principal > a').click(function(){
            var item = $(this).parent();
            if(item.find('.enlaces-hijos-principal').css('display') == 'block')
            {
                item.find('> a').removeClass('abierto');
                item.find('.enlaces-hijos-principal').slideUp('slow');
            }
            else
            {
                item.find('> a').addClass('abierto');
                item.find('.enlaces-hijos-principal').slideDown('slow');
            }
            //item.find('.enlaces-hijos').slideToggle('slow');
            event.stopPropagation();
        });
    };
    /*var iconosOrdenarCamposTabla = function(){
        $('th.asc-desc').click(function(){
            $(this).addClass("desc");
            $(this).removeClass("asc-desc");
        });

        $('th.desc').click(function(){
            $(this).addClass("asc");
            $(this).removeClass("desc");
        });

        $('th.asc').click(function(){
            $(this).addClass("asc-desc");
            $(this).removeClass("asc");
        });
    };*/
    var ocultar_mostrar_div_persiana = function(){
        $('#mostrar-datos-persiana-js').hide();
        $('#cerrar-abrir-persiana-js').click(function(event){
            event.preventDefault();
            $('#mostrar-datos-div-js').slideToggle();
            $('#mostrar-datos-persiana-js').slideToggle(function(){$(document).foundation('equalizer', 'reflow')});
        });
    };
    // Función sustitutiva de "toFixed()" pues ésta tiene un bug documentado cuando el útimo decimal es un 5: 2.835 lo deja como 2.83 y debería ser 2.84.
    // Recibe un número (con '.') para los decimales y sin signo de puntuación de millares y el número de decimales a redondear.
    var redondearDecimales = function (value, decimals) {
        return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
    };
    var descargarArchivo = function(){
        $('.boton-descargar-js').click(function(){
            window.location.href = $(this).data("url");
        });
    }
    var cargarComportamientoSweetAlertEliminar = function(){
        $('.boton-eliminar-js').click(function(event){
            event.preventDefault();
            var $datos = $(this);
            var mensaje = $datos.data('confirm');
            var mensaje2 = $datos.data('confirm2');
            SweetAlert.sweetAlertPregunta(mensaje, (mensaje2) ? mensaje2 : '', function(isConfirmed) {
                if (isConfirmed) {
                    //redirigir a la ruta especificada
                    window.location.href = $datos.data('url');
                }
            });
        });
        $('.boton-pregunta-js').click(function(event){
            event.preventDefault();
            var $datos = $(this);
            var mensaje = $datos.data('confirm');
            SweetAlert.sweetAlertPregunta(mensaje, '', function(isConfirmed) {
                if (isConfirmed) {
                    PeticionAjax.mostrarCargando();
                    //redirigir a la ruta especificada
                    window.location.href = $datos.data('url');
                }
            });
        });
        $('#descarga-facturacion-js').click(function(){
            PeticionAjax.mostrarCargando();

            setTimeout(function(){
                PeticionAjax.ocultarCargando();
            },4000);
        });
        $('.boton-pregunta-campanas-js').click(function(event){
            event.preventDefault();
            var $datos = $(this);
            var mensaje = $datos.data('confirm');
            SweetAlert.sweetAlertPregunta(mensaje, '', function(isConfirmed) {
                if (isConfirmed) {
                    PeticionAjax.mostrarCargando();
                    //redirigir a la ruta especificada
                    window.location.href = $datos.data('url')+'?desde_campanas=true';
                }
            });
        });

        $('.boton-pregunta-click-js').click(function(event){
            event.preventDefault();
            var $datos = $(this);
            var mensaje = $datos.data('confirm');
            var mensaje2 = $datos.data('confirm2');
            SweetAlert.sweetAlertPregunta((mensaje) ? mensaje : '', (mensaje2) ? mensaje2 : '', function(isConfirmed) {
                if (isConfirmed) {
                    PeticionAjax.mostrarCargando();
                    // Hacer click en el elemento indicado
                    $($datos.data('click-id')).click();
                }
            });
        });

        $('.boton-confirmacion-click-con-check-js').click(function(event){
            event.preventDefault();
            var $datos = $(this);
            var check_id = $datos.data('check-id');
            if($(check_id).is(':checked')){
                var mensaje = $datos.data('confirm');
                var mensaje2 = $datos.data('confirm2');
                SweetAlert.sweetAlertPregunta((mensaje) ? mensaje : '', (mensaje2) ? mensaje2 : '', function(isConfirmed) {
                    if (isConfirmed) {
                        PeticionAjax.mostrarCargando();
                        // Hacer click en el elemento indicado
                        $($datos.data('click-id')).click();
                    }
                });
            }else{
                SweetAlert.cargarComportamientoSweetModal(4, $datos.data('mensaje-error'), '');
            }
        });
    };
    var cargarComportamientoSweetAlertEliminarConRedireccion = function(){
        $('.boton-eliminar-con-redireccion-js, .boton-con-redireccion-js').click(function(event){
            event.preventDefault();
            var $datos = $(this);
            var mensaje = $datos.data('confirm');

            SweetAlert.sweetAlertPregunta(mensaje, '', function(isConfirmed) {
                if (isConfirmed) {
                    //--PeticionAjax.mostrarCargando();
                    var data = {};
                    var request = PeticionAjax.post($datos.data('url'), data);
                    request.done(function(res) {
                        //--PeticionAjax.ocultarCargando();
                        window.location.href = $datos.data('url_redirigir');
                    });
                }
            });
        });
    };

    var mobileHeight = function() {
        window.addEventListener('resize', () => {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        });
    }
    var comenzarTrabajoControlTiempos = function() {
        $(".ordenes-abiertas-js").on('click', ".mostrar-modal-crear-comentario-vehiculo-js", function($e){
            $e.stopPropagation();
            var vehiculo_id = $(this).data('vehiculo-id');
            var operacion_id = $(this).data('operacion-id');
            PeticionAjax.mostrarCargando();
            var data = {
                'vehiculo_id': vehiculo_id,
                'operacion_id': operacion_id
            };
            var request = PeticionAjax.get('/operarios/ajax_crear_comentario_vehiculo', data);
            request.done(function(res) {
                PeticionAjax.ocultarCargando();
                $("#ModalCrearComentarioVehiculo").html(res);
                $("#ModalCrearComentarioVehiculo").foundation('reveal', 'open');
            });
        });
        $(".ordenes-abiertas-js").on('click', ".mostrar-modal-ver-comentarios-vehiculo-js", function($e){
            $e.stopPropagation();
            var vehiculo_id = $(this).data('vehiculo-id');
            var operacion_id = $(this).data('operacion-id');
            PeticionAjax.mostrarCargando();
            var data = {
                'vehiculo_id': vehiculo_id,
                'operacion_id': operacion_id
            };
            //$("#ModalCrearComentarioVehiculo").foundation('reveal', 'open');
            var request = PeticionAjax.get('/operarios/ajax_ver_comentarios_vehiculo', data);
            request.done(function(res) {
                PeticionAjax.ocultarCargando();
                $("#div-listado-comentarios").html(res);
                $("#ModalListadoComentariosVehiculo").foundation('reveal', 'open');
            });
        });
        $(".ordenes-abiertas-js").on('click', ".mostrar-modal-ver-motivo-vehiculo-js", function($e){
            $e.stopPropagation();
            var operacion_id = $(this).data('operacion-id');
            PeticionAjax.mostrarCargando();
            var data = {
                'operacion_id': operacion_id
            };
            var request = PeticionAjax.get('/operarios/ajax_ver_motivo_vehiculo', data);
            request.done(function(res) {
                PeticionAjax.ocultarCargando();
                $("#div-motivo").html(res);
                $("#ModalMotivoOperacion").foundation('reveal', 'open');
            });
        });
        /*$(".ordenes-abiertas-js #ModalCrearComentarioVehiculo").on('submit', "#form-crear-comentario-vehiculo-js", function($e){
            $e.preventDefault();
            $e.stopPropagation();
            if($(this).serializeArray()[1].value == '') {
                SweetAlert.cargarComportamientoSweetModal(4, 'Debes introducir un comentario', '');
                return
            }
            var data = $(this).serialize();
            PeticionAjax.mostrarCargando();
            var request = PeticionAjax.post('/operarios/ajax_crear_comentario_vehiculo', data);
            request.done(function(res) {
                PeticionAjax.ocultarCargando();
                var resultado = JSON.parse(res);
                if (resultado.status == "OK") {
                    SweetAlert.cargarComportamientoSweetModal(3, '', '');
                } else {
                    SweetAlert.cargarComportamientoSweetModal(4, 'Error', '');
                }
                $("#ModalCrearComentarioVehiculo").foundation('reveal', 'close');
            });
        });*/
        $(".ordenes-abiertas-js").on('click', ".mostrar-modal-historico-vehiculo-js", function($e){
            $e.stopPropagation();
            var vehiculo_id = $(this).data('vehiculo-id');
            PeticionAjax.mostrarCargando();
            var data = {
                'vehiculo_id': vehiculo_id
            };
            var request = PeticionAjax.post('/operarios/ajax_obtener_historico_vehiculo', data);
            request.done(function(res) {
                PeticionAjax.ocultarCargando();
                $("#ModalHistoricoVehiculo").html(res);
                $("#ModalHistoricoVehiculo").foundation('reveal', 'open');
            });
        });
        $(".ordenes-abiertas-js").on("click", ".mostrar-modal-recambios-en-orden-js", function($e){
            $e.stopPropagation();
            var orden_id = $(this).data('orden-reparacion-id');
            PeticionAjax.mostrarCargando();
            var data = {
                'orden_reparacion_id': orden_id
            };
            var request = PeticionAjax.post('/operarios/ajax_obtener_recambios_para_orden', data);
            request.done(function(res) {
                PeticionAjax.ocultarCargando();
                $("#ModalRecambiosEnOR .content").html(res);
                $("#ModalRecambiosEnOR").foundation('reveal', 'open');
            });
        });

        var clicado = false;
        $("#control-tiempos-iniciar-trabajo-js").click(function(){
            if(!clicado){
                clicado = true;
                var $option = $("#select-tareas-js option:selected");
                var tipo_trabajo = $option.data('tipo');
                var id = $option.val();
                if(tipo_trabajo == "mano_obra") {
                    $.post('/operarios/iniciar_trabajo_linea/'+id, {'DesdeAjax': 1}, function(res){
                        window.location.href = "/operarios/index";
                    });
                }
                else if(tipo_trabajo == "tarea") {
                    $.post('/operarios/ajax_iniciar_trabajo_tarea', {'Tarea': {'tarea_id': id}, 'DesdeAjax': 1}, function(res){
                        window.location.href = "/operarios/index";
                    });
                }
                else{
                    clicado = false;
                    SweetAlert.cargarComportamientoSweetModal(4, $(this).data('mensaje-error'), '');
                    PeticionAjax.ocultarCargando();
                }
            }
        });
        let click_btn_buscador_mecanico = false;
        $(document).off('click','#btn-buscador-mecanico-js').on('click','#btn-buscador-mecanico-js',function(){
            if(!click_btn_buscador_mecanico){
                click_btn_buscador_mecanico = true;
                let matricula = $('#matricula-buscador-mecanico-js').val();
                let orden = $('#orden-buscador-mecanico-js').val();
                if(matricula || orden){
                    PeticionAjax.mostrarCargando();
                    window.location.href = '/operarios?matricula='+matricula+'&orden='+orden;
                }else{
                    click_btn_buscador_mecanico = false;
                    SweetAlert.cargarComportamientoSweetModal(4, $(this).data('mensaje-error'), '');
                }
            }
        });
        $('#matricula-buscador-mecanico-js, #orden-buscador-mecanico-js').keydown(function(event){
            if (event.keyCode == 13){
                $("#btn-buscador-mecanico-js").click();
            }
        });
        $("#ModalCrearComentarioVehiculo").on('click', "#guardar-comentario-js", function($e){
            $e.stopPropagation();
            var operacion_id = $('#operacion-id-js').val();
            var comentario = $('#comentario-js').val();
            PeticionAjax.mostrarCargando();
            var data = {
                'comentario': comentario,
                'operacion_id': operacion_id,
                'sin_leidos': true,
            };
            //$("#ModalCrearComentarioVehiculo").foundation('reveal', 'open');
            var request = PeticionAjax.post('/operarios/crear_comentario_vehiculo', data);
            request.done(function(res) {
                var IS_JSON = true;
                try {
                    var json = $.parseJSON(res);
                }
                catch(err) {
                    IS_JSON = false;
                }

                if(IS_JSON) {
                    var obj = $.parseJSON(res);
                    if(obj.resultado){
                        $('#comentario-js').val('');
                        cargar_comentarios_operacion(data);
                    }else{
                        SweetAlert.cargarComportamientoSweetModal(4, obj.mensaje, '');
                    }
                }else{
                    $("#div-listado-comentarios").html(res);
                    $("#ModalListadoComentariosVehiculo").foundation('reveal', 'open');
                }
                PeticionAjax.ocultarCargando();
            });
        });
        function cargar_comentarios_operacion(data) {
            let request = PeticionAjax.post('/operarios/get_comentarios_operacion', data);
            request.done(function(data){
                PeticionAjax.ocultarCargando();
                $("#div-listado").html(data);
            });
        }
        $(".ordenes-abiertas-js").on('click', ".mostrar-modal-info-tecnica-js", function($e){
            $e.stopPropagation();
            var operacion_id = $(this).data('operacion-id');
            var tecdoc_version = $(this).data('tecdoc_version');
            var haynes_id = $(this).data('haynes_id');
            var is_truck = $(this).data('is_truck');
            var vin = $(this).data('vin');
            PeticionAjax.mostrarCargando();
            var data = {
                'operacion_id': operacion_id,
                'tecdoc_version': tecdoc_version,
                'haynes_id': haynes_id,
                'is_truck': is_truck,
                'vin': vin,
            };
            var request = PeticionAjax.post('/proveedores_informacion_tecnica/ajax_mostrar_lista_informacion_tecnica_operacion', data);
            request.done(function(res) {
                PeticionAjax.ocultarCargando();
                $("#div-lista-info-tecnica").html(res);
                $("#ModalListaInformacionTecnicaVehiculo").foundation('reveal', 'open');
                setTimeout(function(){
                    $('.click-wolf-js').click();
                },1000);
            });
        });
    };
    var imagenesEnFicha = function() {
        $('div.miniatura-ficha > img').click(function(){
            $('#imagenSuperior > img').attr('src', $(this).attr('src'));
        });
        $('div.miniatura-fichero').click(function(){
            window.open($(this).data('link'), '_blank').focus();
        });
    };
    var deshabilitarEnlaceSimple = function(){
        $('.enlace-un-click-js').click(function(event){ $(this).css({'pointer-events': 'none', 'opacity': '.25' }) });
    };
    var cargarComportamientoRegistrarEntrada = function(){
        $('#registrar_entrada_js').click(function(event){
            event.preventDefault();
            PeticionAjax.mostrarCargando();
            var $datos_js = $(this);
            var data = {};
            var request = PeticionAjax.post($datos_js.data('url'), data);
            request.done(function(data){
                window.location.reload();
            });
        });
    };
    var cargarComportamientoRegistrarEntradaVariosCentros = function(){
        $('#elegir_centro_entrada_js').click(function(event){
            event.preventDefault();
            PeticionAjax.mostrarCargando();
            var centro = $('.select_centro_js').val();
            var $datos_js = $(this);
            var data = {'Centro' : centro};
            if(!centro){
                SweetAlert.cargarComportamientoSweetModal(4, $(this).data('mensaje'), '');
                PeticionAjax.ocultarCargando();
            }
            else{
                var request = PeticionAjax.post($datos_js.data('url'), data);
                request.done(function(data){
                    window.location.reload();
                });
            }
        });
    };
    var cargarComportamientoRegistrarSalida = function(){
        $('#registrar_salida_js').click(function(event){
            event.preventDefault();
            PeticionAjax.mostrarCargando();
            var $datos_js = $(this);
            var data = {};
            var request = PeticionAjax.post($datos_js.data('url'), data);
            request.done(function(data){
                window.location.reload();
            });
        });
    };
    var mostrarArrayMensajesError = function(mensajes, tipo){
        if(Array.isArray(mensajes)){
            let textoMensaje = '';
            mensajes.forEach(elements => {
                if(Array.isArray(elements)){
                    elements.forEach(element => {
                        console.log(element);
                        textoMensaje += element + '\n';
                    });
                    textoMensaje += '\n\n';
                }else{
                    textoMensaje += elements + '\n\n';
                }
            });
            SweetAlert.cargarComportamientoSweetModal(tipo, textoMensaje , '');
        }else{
            SweetAlert.cargarComportamientoSweetModal(tipo, mensajes , '');
        }
    };
    var cargarComportamientoSelectOnChangeClick = function(mensajes, tipo){
        $('.select-onchange-click-js').change(function(){
            let datosJs = $(this);
            let idClick = datosJs.data('boton-click');
            $(idClick).click();
        });
    };
    var obtenerIdLineaPedido = function(selector){
        // Como el nombre del input hidden que tiene los atributos data es del formato "chk-linea-pedido_<id>[]"
        // Obtengo el id con la expresión regular para poder obtener los valores de los atributos data y poder marcar y desmarcar los checks correctos
        // El id estará en el índice 1 puesto que pertenece al único grupo de captura de la expresión regular "(\d+)"
        let expr = /_(\d+)\[/;
        let matches = selector.match(expr);
        let linea_id = null;

        if(Array.isArray(matches) && matches.length > 0){
            linea_id = matches[1];
        }

        return linea_id;
    };
    var sanitizeHtml = function(data, options = {}){
        // Añadir excepcion de las etiquetas de iconos
        options['ADD_TAGS'] = ['ion-icon', 'svg'];

        return DOMPurify.sanitize(data, options);
    };
    return {
        load: function(){
            mobileHeight();
            comenzarTrabajoControlTiempos();
            cargarComportamientoTableTrLink();
            mostrarOcultarOrCal();
            controlMenusRWD();
            columnaCoches();
            barraInfoSuperior();
            mainMenu();
            cerrarColumna();
            // impresoraFlotante();
            // enviarFlotante();
            mostrarLinea();
            openCloseOper();
            showMoreBehaviour();
            openCloseOrdenRep();
            mostrarOcultarBuscador();
            mostrarOcultarCrearComentario();
            mostrarOcultarFormulario();
            ampliacion();
            // flechaSubir();
            cerrarMenuClickExterno();
            openCloseUlMenu();
            openQuickLinks();
            openCloseSearcherMobile();
            abrirMenuPrincipal();
            tableResponsive();
            mostrarMatriculas();
            abrirCerrarEnlaces();
            ocultar_mostrar_div_persiana();
            descargarArchivo();
            cargarComportamientoSweetAlertEliminar();
            cargarComportamientoSweetAlertEliminarConRedireccion();
            imagenesEnFicha();
            deshabilitarEnlaceSimple();
            cargarComportamientoRegistrarEntrada();
            cargarComportamientoRegistrarEntradaVariosCentros();
            cargarComportamientoRegistrarSalida();
            cargarComportamientoSelectOnChangeClick();
        },
        cargarComportamientoTableTrLink: function(){
            cargarComportamientoTableTrLink();
        },
        descargarArchivo: function(){
            descargarArchivo();
        },
        cargarComportamientoSweetAlertEliminar: function(){
            cargarComportamientoSweetAlertEliminar();
        },
        cargarComportamientoSweetAlertEliminarConRedireccion: function(){
            cargarComportamientoSweetAlertEliminarConRedireccion();
        },
        redondearDecimales: function(value, decimals){
            return redondearDecimales(value, decimals);
        },
        imagenesEnFicha: function(){
            imagenesEnFicha();
        },
        barraInfoSuperior: function(){
            barraInfoSuperior();
        },
        mostrarArrayMensajesError: function(mensajes, tipo){
            mostrarArrayMensajesError(mensajes, tipo);
        },
        obtenerIdLineaPedido: function(selector){
            return obtenerIdLineaPedido(selector);
        },
        sanitizeHtml: function (data, options = {}) {
            return sanitizeHtml(data, options);
        },
    }
})();
var PeticionAjax  = (function(){
    var get = function(url, data){
        return $.ajax({
        type : "GET",
        encoding: "UTF-8",
        url: url,
        data: data,
        error: function(xmlhttprequest, textstatus, message) {
            if(xmlhttprequest.status == 403){
                window.location.href = '/usuarios/login';
            }else{
                if(textstatus==="timeout") {
                    SweetAlert.cargarComportamientoSweetModal(4, $('#ajax_error_text-js').data('text'), '');
                    ocultarCargando();
                } else {
                    SweetAlert.cargarComportamientoSweetModal(4, $('#ajax_error_text-js').data('text'), '');
                    ocultarCargando();
                }
            }
        }
    });
};
    var post = function(url, data, timeout){
        if(timeout == undefined || timeout == ''){
            timeout = 0;
        }
        return $.ajax({
            type : "POST",
            encoding: "UTF-8",
            url: url,
            data: data,
            timeout: timeout, // límite segundos (si tarda más sale aviso y se cancela la petición)
            error: function(xmlhttprequest, textstatus, message) {
                if(xmlhttprequest.status == 403){
                    window.location.href = '/usuarios/login';
                }else{
                    if(textstatus==="timeout") {
                        SweetAlert.cargarComportamientoSweetModal(4, $('#ajax_error_text-js').data('text'), '');
                        ocultarCargando();
                    } else {
                        SweetAlert.cargarComportamientoSweetModal(4, $('#ajax_error_text-js').data('text'), '');
                        ocultarCargando();
                    }
                }
            }
        });
    };
    var mostrarCargando = function(texto = null){
        if(texto !== null){
            loading = "<div class='mask-up-js' style='background: none repeat scroll 0 0 rgba(0, 0, 0, 0.3); height: 100%; position: fixed; top: 0; width: 100%; z-index: 99999;'><div style='display: flex; max-width: 260px; flex-direction: column; background-color: #fff; font-size: 22px; font-weight: 500; position: fixed; top: 50%; left: 50%; margin-top: -70px; margin-left: -65px; padding: 1em 1.2em .5rem; border-radius: 5px; text-align: center;'><img style='margin-bottom: 5px; width: 100px; margin: 0 auto;' src='/css/img/loading.svg' />"+texto+"<br /></div></div>";
        }else{
            loading = "<div class='mask-up-js' style='background: none repeat scroll 0 0 rgba(0, 0, 0, 0.3); height: 100%; position: fixed; top: 0; width: 100%; z-index: 99999;'><div style='position: fixed; top: 50%; left: 50%; margin-top: -70px; margin-left: -65px; padding: 1em 1.2em .5rem; border-radius: 5px; text-align: center;'><img style='margin-bottom: 5px;' src='/css/img/loading.svg' /><br /></div></div>";
        }

        $('body').append(loading);
    };
    var ocultarCargando = function(){
        $('.mask-up-js').remove();
    };
    var mostrarBotonCargando = function(){
        $('.mostrar-boton-cargando-js').click(function(){
            mostrarCargando();
        });
    };
    return {
        get: function(url, data){
            return get(url, data);
        },
        post: function(url, data, timeout){
            return post(url, data, timeout);
        },
        mostrarCargando: function(texto){
            mostrarCargando(texto);
        },
        ocultarCargando: function(){
            ocultarCargando();
        },
        mostrarBotonCargando: function(){
            mostrarBotonCargando();
        }
    }
})();
var Operario = (function () {
    var SweetAlert_error = 4;
    function asignarEventosModal(){
        $("#container").on("click", "[data-url_modal_operarios]", function(){
            var url = $(this).data("url_modal_operarios");
            if(url){
                $("#ModalOperarios").foundation('reveal', 'open', url);
            }
        });
    }
    /**
     * @param {Element} formulario
     */
    function guardarFormularioAjax(formulario){
        var $formulario = $(formulario);
        var url = $formulario.data('url');
        $.post(url, $formulario.serialize(), function(respuesta){
            var mensaje;
            if(respuesta.guardado === undefined){
                guardarFormularioAjax($formulario);
            }else if(respuesta.guardado){
                top.location.reload(true);
            }else{
                SweetAlert.cargarComportamientoSweetModal(SweetAlert_error, respuesta.mensaje, '');
            }
        });
    }
    return {
        asignarEventosModal: asignarEventosModal,
        detenerTrabajoLinea: guardarFormularioAjax,
        iniciarTrabajoTarea: guardarFormularioAjax,
        finalizarTrabajoTarea: guardarFormularioAjax
    };
})();
var SelectorLineasManoObraParaTiempos = (function(){
    var $modal;
    function init(){
        $modal = $("#ModalTiempos");
        $("select[name$='[orden_reparacion_linea_id]'][data-url]").each(function(){
            var $select = $(this)
                .append(
                    $("<option>"+$(this).data('text')+"</option>").addClass("ver-mas")
                )
                .on("change", function(){
                    var $opcionSeleccionada = $select.find("option:selected");
                    if( $opcionSeleccionada.hasClass("ver-mas") ){
                        $select.val(valorSeleccionado);
                        $modal.data("$select", $select);
                        abrirModal($modal, $(this));
                    }else{
                        valorSeleccionado = $opcionSeleccionada.val();
                    }
                });
            var valorSeleccionado = $select.find("option:selected").val();
        });
    }
    function abrirModal($modal, $select){
        $modal
            .foundation("reveal", "open", $select.data("url"))
            .on("opened.fndtn.reveal", function(e){
                // https://github.com/zurb/foundation-sites/issues/5482
                if( e.namespace !== "fndtn.reveal" ){
                    return;
                }
                JQueryHelper.cargarDatepicker();
            });
        ;
    }
    /**
     * @param {Element} formulario
     */
    function buscarLineas(formulario){
        var $formulario = $(formulario);
        var url = $formulario.data('url');
        var $resultado = $("#" + $formulario.data('id-resultado'));
        $.get(url, $formulario.serialize(), function(respuesta){
            $resultado
                .html(respuesta)
                .on("click", ".seleccionar-fila-resultados-js tbody tr", function(){
                    var $select = $modal.data("$select");
                    var $linea = $(this);
                    var descripcionOrden = $linea.closest("tbody").data("descripcion-orden");
                    var idLinea = $linea.data("id-linea");
                    var descripcionLinea = $linea.data("descripcion-linea");
                    insertarLineaSeleccionada($select, descripcionOrden, idLinea, descripcionLinea);
                    $modal.foundation("reveal", "close");
                });
        });
    }
    function insertarLineaSeleccionada($select, descripcionOrden, idLinea, descripcionLinea){
        var $optgroup, $option;
        $optgroup = $select
            .find("optgroup")
            .filter(function(){
                return $(this).attr("label")==descripcionOrden;
            });
        if($optgroup.length===0){
            $optgroup = $("<optgroup></optgroup>")
                .attr("label", descripcionOrden)
                .insertBefore($select.find(".ver-mas"));
        }
        $option = $optgroup
            .find("option")
            .filter(function(){
                return this.value==idLinea;
            });
        if($option.length===0){
            $option = $("<option></option>")
                .attr("value", idLinea)
                .text(descripcionLinea)
                .appendTo($optgroup);
        }
        $select.val(idLinea);
    }
    return {
        init: init,
        buscarLineas: buscarLineas
    };
})();
jQuery(function($){
    Operario.asignarEventosModal();
});
var CargarSelect2  = (function(){
    var cargar = function(){
        if($('.select2').length) {
            $('.select2').select2({
                    placeholder: "    ",
                    allowClear: true,
                    // tags: true,
                    language: "es",
                }
            );
        }
        if($('.select2-tag').length) {
            $('.select2-tag').select2({
                    placeholder: "    ",
                    allowClear: true,
                    tags: true,
                    language: "es",
                }
            );
        }
        if($('.select2-multiple').length) {
            $('.select2-multiple').select2({
                    placeholder: "    ",
                    allowClear: true,
                    //tags: true,
                    language: "es",
                }
            );
        }
    };

    return {
        load: function($context){
            cargar();
        },
        cargar: function($context){
            cargar();
        },
    }
})();

var SeleccionarSelectorEnFuncionCuadro  = (function(){
    var _fuente;
    var _objetivo;
    var _objetivo_ids;
    var _n_caracteres_empieza_a_buscar;
    var _inicializar = function(cuadro_fuente){
        _fuente = $('.'+cuadro_fuente);
        _objetivo_ids = [];
        if($(_fuente).length){
            _objetivo = $(_fuente).data('objetivo');
            _n_caracteres_empieza_a_buscar = (+$(_fuente).data('n-caracteres-provincia'));
            $("."+$(_fuente).data('objetivo')+">option").map(function() {
                    _objetivo_ids[_objetivo_ids.length] = (+$(this).val());
                    return $(this).val();
            });
            _dotar_eventos();
        }
    };
    var _dotar_eventos = function(){
        $(_fuente).keyup(function(event){
            event.preventDefault();
            if($(this).val().length == _n_caracteres_empieza_a_buscar){
                _buscar($(this).val());
                $('.'+_objetivo).change();
            }
        });
    };
    var _buscar = function(valor){
        var id = jQuery.inArray(+valor, _objetivo_ids);
        if (id !== -1) {
            $('.'+_objetivo+' option:eq('+id+')').prop('selected', true);
        }
    };
    return {
        load: function(selector_fuente){
            _inicializar(selector_fuente);
        },
        _inicializar: function($context){
            _inicializar($context);
        },
    }
})();
var Accion  = (function(){
    var cargarCocheChequeo = function(){
        $bloque_js = $(".cambio-tamanno-tapiz-chequeo-js");
            PeticionAjax.get($bloque_js.data('url')).done(function(data){
                setTimeout(function(){
                    $($bloque_js.data('div')).html(data);
                        setTimeout(function(){
                            Operacion.load();
                        }, 200);
                }, 200);
            });
    };
    return {
        load: function($context){
           //
        },
        cargar: function($context){
            cargarCocheChequeo();
        }
    }
})();
var Tutoriales  = (function(){
    var cargarVideoTutorial = function(){
        $('.visualizar_video_tutorial_js').click(function(event){
            event.preventDefault();
            var $datos_js = $(this);
            var tipo_video = $datos_js.data('tipo_video');
            var data = {};
            data.tipo_video = tipo_video;
            var request = PeticionAjax.post('/video_tutoriales/ajax_cargar_video', data);
            request.done(function(data){
                var IS_JSON = true;
                try {
                    var json = $.parseJSON(data);
                }
                catch(err) {
                    IS_JSON = false;
                }
                if(IS_JSON) {
                    var obj = $.parseJSON(data);
                    // error
                    SweetAlert.cargarComportamientoSweetModal(4, obj.texto, '');
                }
                else {
                    $('#div-cargar-video-tutorial-js').html(data);
                    $('#ModalVisualizarVideoTurorial').foundation('reveal', 'open');
                    Tutoriales.cargarFuncionalidadVisitas();
                }
            });
        });
        $('#pausar-video').click(function(){
            $('.videoTutorialJs').trigger("pause");
        });
    };
    var cargarFuncionalidadVisitas = function(){
        $('.videoTutorialJs').on('play', function() {
            var $datos_js = $(this);
            if(!$datos_js.hasClass('visualizado')){
                // Añadir clase 'visulizado' para no contar otra visita si hace 'pause & play'
                $datos_js.addClass('visualizado');
                var tipo_video = $datos_js.data('tipo_video');
                var data = {};
                data.tipo_video = tipo_video;
                var request = PeticionAjax.post('/video_tutoriales/ajax_sumar_visita', data);
                request.done(function(data){
                    var IS_JSON = true;
                    try {
                        var json = $.parseJSON(data);
                    }
                    catch(err) {
                        IS_JSON = false;
                    }
                    if(IS_JSON) {
                        //var obj = $.parseJSON(data);
                        // error
                        //SweetAlert.cargarComportamientoSweetModal(4, obj.texto, '');
                    }
                });
            }
        });
    };
    return {
        load: function($context){
            cargarVideoTutorial();
            cargarFuncionalidadVisitas();
        },
        cargarFuncionalidadVisitas: function($context){
            cargarFuncionalidadVisitas();
        },
    }
})();
var LicenciaAutogest  = (function(){
    var deshabilitarEnlacesBotones = function(){
        $('.control_licencia_js').click(function(event){
            event.preventDefault();
            event.stopImmediatePropagation();
            return false;
        });

        $(window).load(function(){
            setTimeout(function(){
                $('.control_licencia_event_js').off('click');
            },500);
        });
    };

    return {
        load: function(){
            deshabilitarEnlacesBotones();
        },
        deshabilitarEnlacesBotones: function(){
            deshabilitarEnlacesBotones();
        },
    }
})();

var DetalleLineas  = (function(){

    var mostrarLineas = function(){
        $(document).on('click', '.mostrar_lineas-js', function(e){
            e.preventDefault();
            id = $(this).data('id');
            url = $(this).data('url');
            destino = '#linea_'+ id +'-js';

            data = {};
            data.id = id;
            data.modelo = $(this).data('modelo');

            if(url){
                var request = PeticionAjax.post(url, data);
                request.done(function (data) {
                    var IS_JSON = true;
                    try {
                        var json = $.parseJSON(data);
                    }
                    catch(err) {
                        IS_JSON = false;
                    }

                    if(IS_JSON) {
                        SweetAlert.cargarComportamientoSweetModal(4, 'Error', '');
                    }else{
                        $(destino).html(data);
                    }
                });
            }

            if($('#linea_'+id+'-js').is(':visible'))
            {
                $('#linea_'+id+'-js').slideUp();
                $(this).removeClass('abierto');
            }
            else
            {
                $('#linea_'+id+'-js').slideDown();
                $(this).addClass('abierto');
            }
        });
    };

    return {
        load: function(){
            mostrarLineas();
        },
    }

})();

function cambiarColorVehiculo(color) {
    $('#imagen-vehiculo-js').attr('src', $('#imagen-vehiculo-js').data('url_imagen') + '?modelColor=' + color.substr(1));
}

var actualizar_datos_distribuidor_erp = function(){
    $('.actualizar_datos_distribuidor_erp-js').on('click', function(){
        var url = $(this).data('url');
        PeticionAjax.mostrarCargando();
        var request = PeticionAjax.post(url, data);
        request.done(function (data) {
            $('#ActualizacionDatosDistribuidor').html(data);
            PeticionAjax.ocultarCargando();
            $('#ActualizacionDatosDistribuidor').foundation('reveal', 'open');
        });
    });
}

var close_alert_box = function(){ $('.alert-box .close').click(function(){ $(this).parent().fadeOut(); }); }

var selecLevelsArticlesTree = function(){

    $("select.selector_enlazado").each(function(){
        var selectPadre = $(this);
        var selectHijo = selectPadre.data('selector_hijo');
        selectPadre.change(function(){
            var valueSelectPadre = selectPadre.find(':selected').val();
            if(valueSelectPadre == '' || valueSelectPadre == 0){
                $(selectHijo).prop('disabled', true);
            }else{
                $(selectHijo).prop('disabled', false);
            }
            $.ajax({
                dataType: "json",
                url: selectPadre.data("url"),
                data: {
                    id: selectPadre.val()
                },
                cache: false,
                success: function(data){
                    $(selectHijo).empty().append("<option></option>");
                    $.each(data, function(clave, valor){
                            $(selectHijo).append(
                            $("<option></option>").val(clave).text(valor)
                        );
                    });
                }
            });
        })
    });
    var $count = 10000;
    $('#select_level2').change(function(){
        var valueSelect = $(this).find(':selected').val();
        $count ++;
        if(valueSelect != ''){
            var level_1_id = $('#select_level1').find(':selected').val();
            if(valueSelect == 0){
                $.ajax({
                    dataType: "json",
                    url: WEB + 'categoriasdestacadas/get_nombre_id_categoria_js',
                    data: {
                        id: level_1_id,
                        familias: 'familias'
                    },
                    cache: false,
                    success: function(data){
                        $('#contenedor_listado_genarts_categorias table > tbody').append('<tr class="categorias_seleccionadas" id="categoria_eliminar_'+ $count +'">'+
                                                                            '<td>Familia: '+ data.nombre + '</td>'+
                                                                            '<td id="eliminar_'+ $count +'" data-level_id="'+ level_1_id +'" class="right eliminar_categorias cursor-pointer"> <span class="icon ion-ios-trash c-fallo"></span> </td>'+
                                                                        '</tr>')
                                                                        .ready(function () {
                                                                            eliminar_categorias_seleccionadas();
                                                                        });
                        var coleccion_level1 = $('#coleccion_ids_level_1').attr('value');
                        var nuevo_valor = coleccion_level1 + level_1_id + '_';
                        $('#coleccion_ids_level_1').attr('value', nuevo_valor);
                    }
                });
            }else{
                $.ajax({
                    dataType: "json",
                    url: WEB + 'categoriasdestacadas/get_nombre_id_categoria_js',
                    data: {
                        id: valueSelect,
                        level_1_id: level_1_id,
                        familias: 'subfamilias'
                    },
                    cache: false,
                    success: function(data){
                        $('#contenedor_listado_genarts_categorias table > tbody').append('<tr class="categorias_seleccionadas" id="categoria_eliminar_'+ $count +'">'+
                                                                            '<td>Subfamilia: '+ data.nombre +'</td>'+
                                                                            '<td id="eliminar_'+ $count +'" data-level_id="'+ valueSelect +'" class="right eliminar_categorias_seleccionadas cursor-pointer"> <span class="icon ion-ios-trash c-fallo"></span> </td>'+
                                                                            '</tr>')
                                                                            .ready(function () {
                                                                                eliminar_categorias_seleccionadas();
                                                                            });

                        var coleccion_level2 = $('#coleccion_ids_level_2').attr('value');
                        var nuevo_valor = coleccion_level2+valueSelect +'_';
                        $('#coleccion_ids_level_2').attr('value', nuevo_valor);
                    }
                });
            }
        }

    })

    var eliminar_categorias_seleccionadas = function(){
        $('.eliminar_categorias').on('click', function(){
            var elemento = $(this);
            eliminar_categoria('#coleccion_ids_level_1', elemento);
        });
        $('.eliminar_categorias_seleccionadas').on('click', function(){
            var elemento = $(this);
            eliminar_categoria('#coleccion_ids_level_2', elemento);
        });
    }

    $('.eliminar_familia_seleccionada').on('click', function(){
        var elemento = $(this);
        eliminar_categoria('#coleccion_ids_level_1', elemento);
    });

    $('.eliminar_subfamilia_seleccionada').on('click', function(){
        var elemento = $(this);
        eliminar_categoria('#coleccion_ids_level_2', elemento);
    });

    function eliminar_categoria (id_selector, elemento){
        let categoria = elemento.attr('id');
        let level_id = elemento.data('level_id');
        $('#categoria_'+ categoria).remove();
        coleccion = $(id_selector).attr('value');
        var longitud_id;
        if(typeof(level_id) !== 'string'){
            longitud_id = level_id.toString().length;
        }else{
            longitud_id = level_id.length;
        }
        let cadena_busqueda = '_'+ level_id +'_';
        let indice = coleccion.indexOf(cadena_busqueda);
        if(indice >= 0){
            let cadena1 = coleccion.substr(0, indice);
            let cadena2 = coleccion.substr(indice+longitud_id+1);
            nuevo_valor = cadena1+cadena2;
            $(id_selector).attr('value', nuevo_valor);
        }
    }
};

var cargar_funcionamiento_desplegable_almacenes = function(){
    $(document).off('click','.btn-cargar-modal-seleccion-almacenes-pedido-js').on('click','.btn-cargar-modal-seleccion-almacenes-pedido-js',function(event){
        event.preventDefault();

        var $datos_js = $(this);
        var linea_id = $datos_js.data('linea_id');

        var data = {};
        data.linea_id = linea_id;
        data.articulo_id = $datos_js.data('articulo_id');
        data.referencia = $datos_js.data('referencia');
        data.proveedor_nombre = $datos_js.data('proveedor_nombre');
        data.articulo_nombre = $datos_js.data('articulo_nombre');
        data.modelo = $datos_js.data('modelo');
        data.unidades = $datos_js.data('unidades');
        data.destino_modal_id = $datos_js.data('destino_modal_id');

        var request = PeticionAjax.post('/seleccion_articulos/cotizaciones/ajax_seleccion_almacenes_linea_pedido', data);
        PeticionAjax.mostrarCargando();

        request.done(function(data){

            var IS_JSON = true;
            try {
                var json = $.parseJSON(data);
            }
            catch(err) {
                IS_JSON = false;
            }

            if(IS_JSON) {
                var obj = $.parseJSON(data);
                SweetAlert.cargarComportamientoSweetModal(4, obj.texto, '');
            }
            else {
                //abrir modal
                $('#div-lista-almacenes-linea-pedido-js').html(data);
                $('#ModalSeleccionarAlmacenesLineaPedido').foundation('reveal', 'open');
            }
            PeticionAjax.ocultarCargando();
        });

    });
    
    $('#div-lista-almacenes-linea-pedido-js').off('click','#seleccion-almacenes-linea-pedido-js').on('click','#seleccion-almacenes-linea-pedido-js', function(event){
        event.preventDefault();
        PeticionAjax.mostrarCargando();

        var $datos_js = $(this);
        var linea_id = $datos_js.data('linea_id');
        var destino_modal_id = $datos_js.data('destino_modal_id');
        var con_disponibilidad = $datos_js.data('con_disponibilidad');
        var checkbox_sucursal = $('#seleccion-almacen-sucursal-js').is(":checked");
        var almacenes_seleccionados = [];
        var max_unidades_pedido = $('#max_unidades_linea_pedido_js').data('unidades_pedido');
        var unidades_asignadas = 0;

        var lista_almacenes = [];
        if(con_disponibilidad){
            var string_almacenes = '';
            $('.almacen-unidades-js').each(function(index) {
                let unidades = $(this).val();
                if(parseInt(unidades) > 0){
                    lista_almacenes.push({
                        'almacen_key': $(this).data('key'),
                        'nombre': $(this).data('nombre_almacen'),
                        'unidades': unidades
                    });

                    unidades_asignadas += parseInt(unidades);
                    string_almacenes += $(this).data('descripcion_almacen') + ' (' + unidades + ') ';

                    almacenes_seleccionados.push(
                        {
                            'nombre': $(this).data('key'),
                            'descripcion': $(this).data('descripcion_almacen') + ' (' + unidades + ') ',
                            'unidades': unidades
                        }
                    );
                }
                if(checkbox_sucursal && index === 0){
                    $('.stockSvg'+linea_id+' path').css('fill', '#0f0');
                    if($datos_js.data('unidades-sucursal') > 0){
                        lista_almacenes.push({
                            'almacen_key': $(this).data('key'),
                            'nombre': $(this).data('nombre_almacen'),
                            'unidades':  $datos_js.data('unidades-sucursal')
                        });
                        unidades_asignadas += parseInt($datos_js.data('unidades-sucursal'));
                        almacenes_seleccionados.push(
                            {
                                'nombre': $(this).data('key'),
                                'unidades': $datos_js.data('unidades-sucursal')
                            }
                        );
                    }
                    if($datos_js.data('sucursal-faltan')){
                        lista_almacenes.push({
                            'almacen_key': $(this).data('key'),
                            'nombre': $(this).data('nombre_almacen'),
                            'unidades':  $datos_js.data('sucursal-faltan')
                        });
                        unidades_asignadas += parseInt($datos_js.data('sucursal-faltan'));
                        almacenes_seleccionados.push(
                            {
                                'nombre': $(this).data('key'),
                                'unidades': $datos_js.data('sucursal-faltan')
                            }
                        );
                    }
                    if($datos_js.data('unidades-sucursal')){
                        string_almacenes += $(this).data('descripcion_almacen') + ' (' +  $datos_js.data('unidades-sucursal') + ') <br>';
                    }

                    if($datos_js.data('sucursal-faltan') !== 0){
                        string_almacenes += $(this).data('descripcion_almacen') + ' - ' + $datos_js.data('texto_sin_disponibilidad') + ': ' + $datos_js.data('sucursal-faltan')
                    }

                }
            });

            if(max_unidades_pedido>unidades_asignadas){
                var unidades_faltan = max_unidades_pedido - unidades_asignadas;
                var mi_sucursal = $('.almacen-unidades-js').first();
                lista_almacenes.push({
                    'almacen_key': mi_sucursal.data('key'),
                    'nombre': mi_sucursal.data('nombre_almacen'),
                    'unidades':  unidades_faltan
                });
                almacenes_seleccionados.push(
                    {
                        'nombre': mi_sucursal.data('nombre_almacen'),
                        'unidades': unidades_faltan
                    }
                );
                string_almacenes += mi_sucursal.data('nombre_almacen') + ' - ' + $datos_js.data('texto_sin_disponibilidad') + ': ' + unidades_faltan
            }

        }else{
            var string_almacenes = $datos_js.data('texto_sin_disponibilidad');
            lista_almacenes.push({
                'almacen_key': 'SIN_DISPONIBILIDAD',
                'nombre': string_almacenes,
                'unidades': 0
            });
        }
        // Añadir almacenes a la linea del pedido/cotización correspondiente
        almacenes_lineas_pedido[linea_id] = lista_almacenes;
        $('#almacenes_linea_id_' + linea_id).html(string_almacenes);
        $('#default_warehouse_' + linea_id).val( JSON.stringify(almacenes_seleccionados) );

        if(lista_almacenes.length > 0){
            $('.almacen-' + linea_id).hide();
            $('.listadoStock' + linea_id).prop('disabled', true);
            if(!checkbox_sucursal){
                $('.stockSvg'+linea_id+' path').css('fill', lista_almacenes.length > 1 ? '#3D50F2' : '#0f0')
            }
        } else {
            $('.almacen-' + linea_id).show();
            $('.listadoStock' + linea_id).prop('disabled', false);
            $('.stockSvg'+linea_id+' path').removeAttr('style');
        }


        // Cerrar modal y abrir la modal de pedido
        $('#ModalSeleccionarAlmacenesLineaPedido').foundation('reveal', 'close');
        setTimeout(function(){
            $(destino_modal_id).foundation('reveal', 'open');
            PeticionAjax.ocultarCargando();
        }, 500);
    });

    $('#div-lista-almacenes-linea-pedido-js').on('change','.almacen-unidades-js', function(event){
        event.preventDefault();
        var $datos_js = $(this);
        var max_unidades_pedido = $('#max_unidades_linea_pedido_js').data('unidades_pedido');

        var sumatorio_unidades = 0;
        $('.almacen-unidades-js').each(function() {
            let unidades = $(this).val();
            sumatorio_unidades += parseInt(unidades);
        });

        if(parseInt(sumatorio_unidades) > parseInt(max_unidades_pedido)){
            $datos_js.val(0);
            SweetAlert.cargarComportamientoSweetModal(4, $('#max_unidades_linea_pedido_js').data('mensaje-error'), 'Error');
            return;
        }

        $('#total_unidades_almacenes_linea_pedido_js').html(sumatorio_unidades);
    });

    $('#check-seleccionar-todos-proveedores').on('click', function(event){
        if($(this).is(':checked')){
            $('#seleccionar-proveedores').prop("disabled", true);
        }else{
            $('#seleccionar-proveedores').prop("disabled", false);
            $('#seleccionar-proveedores').val([]);
            $('#seleccionar-proveedores').change();
        }
    });
}

var loadGMSAngular = function(){
    $('#load-gms-angular-data-js').ready(function(event){
        if($('#load-gms-angular-data-js').length){
            if($('#create-token-gsmart-js').length || !sessionStorage.getItem('tokenGsmart')){
                let redirect_url = $('#create-token-gsmart-js').data('redirect-url');
                var data = {};
                var request = PeticionAjax.post('/paginas/ajax_cargar_gms_angular', data);
                request.done(function (data) {
                    var json = $.parseJSON(data);
                    if(json['token']){
                        sessionStorage.setItem('tokenGsmart', json['token']);
                        sessionStorage.setItem('angularGsmart', json['angularGsmart']);
                        if(redirect_url){
                            window.location.href = redirect_url;
                        }
                    }
                });
            }
        }
    });

    $('#remove-gms-angular-data-js').ready(function(event){
        if($('#remove-gms-angular-data-js').length){
            sessionStorage.removeItem('tokenGsmart');
            sessionStorage.removeItem('centroIdGsmart');
        }
    });
};