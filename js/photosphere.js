var gl;
var shader_program;

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
	'//uniform float width;\n' +
	'//uniform float height;\n' +
	'//uniform float aspect;\n' +
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
	'	if (ray_dir.y > 0.0) {\n' +
	'		ray_yaw = -asin(ray_dir.x);\n' +
	'	} else if (ray_dir.y < 0.0) {\n' +
	'		if (ray_dir.x > 0.0) {\n' +
	'			ray_yaw = -PI + asin(ray_dir.x);\n' +
	'		} else {\n' +
	'			ray_yaw = PI + asin(ray_dir.x);\n' +
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
	'	tex_pos.x = (1.0 + ray_yaw / PI) / 2.0;\n' +
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
/*
	shader_program.unif_width = gl.getUniformLocation(shader_program, 'width');
	shader_program.unif_height = gl.getUniformLocation(shader_program, 'height');
	shader_program.unif_aspect = gl.getUniformLocation(shader_program, 'aspect')
*/
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
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		// Clamp horizontally, but not vertically
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); 
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP);

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

	// Fov is calculated from top edge to bottom edge
	var fov_y_degrees = 75;

	var camera_rot = new Float32Array([
		1, 0, 0,
		0, 1, 0,
		0, 0, 1
	]);

	var aspect = gl.viewport_width / gl.viewport_height;

	var fov_y = fov_y_degrees / 180 * Math.PI;
	var fov_x = 2 * Math.atan(aspect * Math.tan(fov_y / 2))

	gl.uniform1f(shader_program.unif_fov_x, fov_x);
	gl.uniform1f(shader_program.unif_fov_y, fov_y);
/*
	gl.uniform1f(shader_program.unif_width, gl.viewport_width);
	gl.uniform1f(shader_program.unif_height, gl.viewport_height);
	gl.uniform1f(shader_program.unif_aspect, aspect);
*/
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

	init_gl(canvas);
	shader_program = init_shaders();
	init_buffers();
	init_texture(image_src);

	gl.clearColor(0.0, 0.0, 0.0, 1.0);

	draw_sphere();
}
