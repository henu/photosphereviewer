var gl;
var shader_program;

// Fov is calculated from top edge to bottom edge
var camera_rotating = false;
var camera_fov_y_degrees = 45;
var camera_pitch = 0;
var camera_yaw = 0;
var mouse_last_pos_x = 0;
var mouse_last_pos_y = 0;

function init_gl(canvas)
{
	try {
		gl = canvas.getContext('experimental-webgl');
		gl.viewport_width = canvas.width;
		gl.viewport_height = canvas.height;
	}
	catch (e) {
	}
	if (!gl) {
		alert('Unable to initialize WebGL!');
	}
}

function compile_shader(gl, code, type)
{
	var shader = gl.createShader(type);

	gl.shaderSource(shader, code);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}

function init_shaders()
{
	var vertex_shader_code =
	'attribute vec2 vrt_pos;\n' +
	'\n' +
	'varying vec2 pos;\n' +
	'\n' +
	'void main(void) {\n' +
	'	pos = vrt_pos;\n' +
	'	gl_Position = vec4(vrt_pos, 0.0, 1.0);\n' +
	'}\n';

	var fragment_shader_code =
	'precision mediump float;\n' +
	'\n' +
	'uniform sampler2D tex;\n' +
	'uniform float fov_x;\n' +
	'uniform float fov_y;\n' +
	'uniform mat3 camera_rot;\n' +
	'\n' +
	'varying vec2 pos;\n' +
	'\n' +
	'#define PI 3.1415926535897932384626433832795\n' +
	'\n' +
	'void main(void) {\n' +
	'	\n' +
	'	// Calculate ray direction in space of monitor\n' +
	'	vec3 ray_dir;\n' +
	'	ray_dir.x = tan(fov_x / 2.0) * pos.x;\n' +
	'	ray_dir.y = 1.0;\n' +
	'	ray_dir.z = tan(fov_y / 2.0) * pos.y;\n' +
	'	\n' +
	'	// Apply camera rotation and normalize\n' +
	'	ray_dir = normalize(camera_rot * ray_dir);\n' +
	'	\n' +
	'	// Calculate pitch and yaw of ray\n' +
	'	float ray_pitch = asin(ray_dir.z);\n' +
	'	float ray_yaw;\n' +
	'	float ray_dir_xy_len = sqrt(ray_dir.x*ray_dir.x + ray_dir.y*ray_dir.y);\n' +
	'	vec2 ray_dir_xy;\n' +
	'	if (ray_dir_xy_len > 0.0) {\n' +
	'		ray_dir_xy.x = ray_dir.x / ray_dir_xy_len;\n' +
	'		ray_dir_xy.y = ray_dir.y / ray_dir_xy_len;\n' +
	'	} else {\n' +
	'		ray_dir_xy = vec2(0.0, 0.0);\n' +
	'	}\n' +
	'	if (ray_dir.y > 0.0) {\n' +
	'		ray_yaw = -asin(ray_dir_xy.x);\n' +
	'	} else if (ray_dir.y < 0.0) {\n' +
	'		if (ray_dir.x > 0.0) {\n' +
	'			ray_yaw = -PI + asin(ray_dir_xy.x);\n' +
	'		} else {\n' +
	'			ray_yaw = PI + asin(ray_dir_xy.x);\n' +
	'		}\n' +
	'	} else {\n' +
	'		if (ray_dir.x > 0.0) {\n' +
	'			ray_yaw = -PI / 2.0;\n' +
	'		} else {\n' +
	'			ray_yaw = PI / 2.0;\n' +
	'		}\n' +
	'	}\n' +
	'	\n' +
	'	// Calculate position in texture\n' +
	'	vec2 tex_pos;\n' +
	'	tex_pos.x = 0.5 - ray_yaw / PI / 2.0;\n' +
	'	tex_pos.y = 0.5 + ray_pitch / PI;\n' +
	'	\n' +
	'	gl_FragColor = texture2D(tex, tex_pos);\n' +
	'}\n';

	var vertex_shader = compile_shader(gl, vertex_shader_code, gl.VERTEX_SHADER);
	var fragment_shader = compile_shader(gl, fragment_shader_code, gl.FRAGMENT_SHADER);

	var shader_program = gl.createProgram();
	gl.attachShader(shader_program, fragment_shader);
	gl.attachShader(shader_program, vertex_shader);
	gl.linkProgram(shader_program);

	if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
		alert('Unable to link shaders!');
	}

	gl.useProgram(shader_program);

	shader_program.vrt_pos_attr = gl.getAttribLocation(shader_program, 'vrt_pos');
	gl.enableVertexAttribArray(shader_program.vrt_pos_attr);

	shader_program.unif_tex = gl.getUniformLocation(shader_program, 'tex');
	shader_program.unif_fov_x = gl.getUniformLocation(shader_program, 'fov_x');
	shader_program.unif_fov_y = gl.getUniformLocation(shader_program, 'fov_y');
	shader_program.unif_camera_rot = gl.getUniformLocation(shader_program, 'camera_rot');

	return shader_program;
}

var vrt_pos_buf;

function init_buffers()
{
	vrt_pos_buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vrt_pos_buf);
	var vertices = [
		 1, -1,
		 1,  1,
		-1, -1,
		-1,  1
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	vrt_pos_buf.item_size = 2;
	vrt_pos_buf.num_items = 4;
}

var texture;
function init_texture(image_src)
{
	texture = gl.createTexture();
	texture.image = new Image();
	texture.image.onload = function() {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		// Clamp horizontally, but not vertically
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); 
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		gl.bindTexture(gl.TEXTURE_2D, null);
		texture.loaded = true;
		draw_sphere();
	}

	texture.image.src = image_src;
}

function draw_sphere()
{
	gl.viewport(0, 0, gl.viewport_width, gl.viewport_height);

	if (texture.loaded) {
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(shader_program.unif_tex, 0);
	}

	var camera_yaw_mat_raw = [
		 Math.cos(camera_yaw), Math.sin(camera_yaw), 0,
		-Math.sin(camera_yaw), Math.cos(camera_yaw), 0,
		 0,                    0,                    1
	]

	var camera_pitch_mat_raw = [
		1,  0,                      0,
		0,  Math.cos(camera_pitch), Math.sin(camera_pitch),
		0, -Math.sin(camera_pitch), Math.cos(camera_pitch)
	]

	var camera_mat_raw = multiply_matrices(camera_pitch_mat_raw, camera_yaw_mat_raw);

	var camera_rot = new Float32Array(camera_mat_raw);

	var aspect = gl.viewport_width / gl.viewport_height;

	var fov_y = camera_fov_y_degrees / 180 * Math.PI;
	var fov_x = 2 * Math.atan(aspect * Math.tan(fov_y / 2))

	gl.uniform1f(shader_program.unif_fov_x, fov_x);
	gl.uniform1f(shader_program.unif_fov_y, fov_y);
	gl.uniformMatrix3fv(shader_program.unif_camera_rot, false, camera_rot);

	gl.bindBuffer(gl.ARRAY_BUFFER, vrt_pos_buf);
	gl.vertexAttribPointer(shader_program.vrt_pos_attr, vrt_pos_buf.item_size, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, vrt_pos_buf.num_items);
}

function show_photosphere(canvas_id, image_src)
{
	var canvas = document.getElementById(canvas_id);
	if (!canvas) {
		alert('Unable to find canvas with ID "' + canvas_id + '"!');
		return;
	}

	canvas.width = canvas.offsetWidth;
	canvas.height = canvas.offsetHeight;

	// Listen mouse dragging
	canvas.addEventListener('mousedown', function(event){
		if (event.button == 0) {
			camera_rotating = true;
			mouse_last_pos_x = event.screenX;
			mouse_last_pos_y = event.screenY;
		}
	});	
	canvas.addEventListener('mouseup', function(event){
		if (event.button == 0) {
			camera_rotating = false;
		}
	});
	canvas.addEventListener('mousemove', function(event){
		if ((event.buttons != undefined && event.buttons & 1) ||
		    (event.buttons == undefined && camera_rotating)) {
			var delta_x = event.screenX - mouse_last_pos_x;
			var delta_y = event.screenY - mouse_last_pos_y;
			mouse_last_pos_x = event.screenX;
			mouse_last_pos_y = event.screenY;

			var rot_speed = camera_fov_y_degrees / 35000;

			camera_yaw += delta_x * rot_speed;
			camera_pitch += delta_y * rot_speed;
			if (camera_pitch > Math.PI / 2) {
				camera_pitch = Math.PI / 2;
			} else if (camera_pitch < -Math.PI / 2) {
				camera_pitch = -Math.PI / 2;
			}
			draw_sphere();
		}
	});
	// Listen mouse wheel
	canvas.addEventListener('mousewheel', function(event){
		camera_fov_y_degrees -= event.wheelDelta * 0.025;
		if (camera_fov_y_degrees < 15) {
			camera_fov_y_degrees = 15;
		}
		if (camera_fov_y_degrees > 90) {
			camera_fov_y_degrees = 90;
		}
		draw_sphere();
	});	

	init_gl(canvas);
	shader_program = init_shaders();
	init_buffers();
	init_texture(image_src);

	gl.clearColor(0.0, 0.0, 0.0, 1.0);

	draw_sphere();
}

function multiply_matrices(a, b)
{
	return [
		a[0]*b[0] + a[1]*b[3] + a[2]*b[6], a[0]*b[1] + a[1]*b[4] + a[2]*b[7], a[0]*b[2] + a[1]*b[5] + a[2]*b[8],
		a[3]*b[0] + a[4]*b[3] + a[5]*b[6], a[3]*b[1] + a[4]*b[4] + a[5]*b[7], a[3]*b[2] + a[4]*b[5] + a[5]*b[8],
		a[6]*b[0] + a[7]*b[3] + a[8]*b[6], a[6]*b[1] + a[7]*b[4] + a[8]*b[7], a[6]*b[2] + a[7]*b[5] + a[8]*b[8]
	];
}
