var Photosphere = function(canvas_id, image_src, image_low_src)
{
	// Fov is calculated from top edge to bottom edge
	this.camera_rotating = false;
	this.camera_fov_y_degrees = 60;
	this.camera_pitch = 0;
	this.camera_yaw = 0;
	this.mouse_last_pos_x = 0;
	this.mouse_last_pos_y = 0;

	this.canvas = document.getElementById(canvas_id);
	if (!this.canvas) {
		alert('Unable to find canvas with ID "' + canvas_id + '"!');
		return;
	}

	this.canvas.width = this.canvas.offsetWidth;
	this.canvas.height = this.canvas.offsetHeight;

	// Listen mouse dragging
	var photosphere = this;
	this.canvas.addEventListener('mousedown', function(event) {
		photosphere.mouse_event_down(event);
	});	
	this.canvas.addEventListener('mouseup', function(event) {
		photosphere.mouse_event_up(event);
	});
	canvas.addEventListener('mousemove', function(event) {
		photosphere.mouse_event_move(event);
	});
	// Listen mouse wheel
	this.canvas.addEventListener('mousewheel', function(event) {
		photosphere.mouse_event_wheel(event);
	});	
	this.canvas.addEventListener('DOMMouseScroll', function(event) {
		photosphere.mouse_event_wheel(event);
	});	

	this.init_gl();
	this.init_shaders();
	this.init_buffers();
	this.init_texture(image_src, image_low_src);

	this.gl.clearColor(0.0, 0.0, 0.0, 1.0);

	this.draw_sphere();
}

Photosphere.prototype.init_gl = function()
{
	try {
		this.gl = this.canvas.getContext('experimental-webgl');
		this.gl.viewport_width = this.canvas.width;
		this.gl.viewport_height = this.canvas.height;
	}
	catch (e) {
	}
	if (!this.gl) {
		alert('Unable to initialize WebGL!');
	}
}

Photosphere.prototype.compile_shader = function(code, type)
{
	var shader = this.gl.createShader(type);

	this.gl.shaderSource(shader, code);
	this.gl.compileShader(shader);

	if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}

Photosphere.prototype.init_shaders = function()
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
	'// TODO: Yaw calculation here still has tiny errors, when ray points left or right!\n' +
	'	if (ray_dir_xy.x <= -1.0) {\n' +
	'		ray_yaw = PI / 2.0;\n' +
	'	} else if (ray_dir_xy.x >= 1.0) {\n' +
	'		ray_yaw = -PI / 2.0;\n' +
	'	} else if (ray_dir.y > 0.0) {\n' +
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

	var vertex_shader = this.compile_shader(vertex_shader_code, this.gl.VERTEX_SHADER);
	var fragment_shader = this.compile_shader(fragment_shader_code, this.gl.FRAGMENT_SHADER);

	this.shader_program = this.gl.createProgram();
	this.gl.attachShader(this.shader_program, fragment_shader);
	this.gl.attachShader(this.shader_program, vertex_shader);
	this.gl.linkProgram(this.shader_program);

	if (!this.gl.getProgramParameter(this.shader_program, this.gl.LINK_STATUS)) {
		alert('Unable to link shaders!');
	}

	this.gl.useProgram(this.shader_program);

	this.shader_program.vrt_pos_attr = this.gl.getAttribLocation(this.shader_program, 'vrt_pos');
	this.gl.enableVertexAttribArray(this.shader_program.vrt_pos_attr);

	this.shader_program.unif_tex = this.gl.getUniformLocation(this.shader_program, 'tex');
	this.shader_program.unif_fov_x = this.gl.getUniformLocation(this.shader_program, 'fov_x');
	this.shader_program.unif_fov_y = this.gl.getUniformLocation(this.shader_program, 'fov_y');
	this.shader_program.unif_camera_rot = this.gl.getUniformLocation(this.shader_program, 'camera_rot');
}

Photosphere.prototype.init_buffers = function()
{
	this.vrt_pos_buf = this.gl.createBuffer();
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vrt_pos_buf);
	var vertices = [
		 1, -1,
		 1,  1,
		-1, -1,
		-1,  1
	];
	this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
	this.vrt_pos_buf.item_size = 2;
	this.vrt_pos_buf.num_items = 4;
}

Photosphere.prototype.init_texture = function(image_src, image_low_src)
{
	if (image_low_src) {
		this.texture_low = this.gl.createTexture();
		this.texture_low.image = new Image();
		var photosphere = this;
		var texture_low = this.texture_low;
		this.texture_low.image.onload = function() {
			photosphere.image_loaded(texture_low);
		}
		this.texture_low.image.src = image_low_src;
	}

	this.texture = this.gl.createTexture();
	this.texture.image = new Image();
	var photosphere = this;
	var texture = this.texture;
	this.texture.image.onload = function() {
		photosphere.image_loaded(texture);
	}
	this.texture.image.src = image_src;
}

Photosphere.prototype.image_loaded = function(texture)
{
	this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
	this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
	this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, texture.image);
	this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
	this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
	// Clamp horizontally, but not vertically
	this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT); 
	this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

	this.gl.bindTexture(this.gl.TEXTURE_2D, null);
	texture.loaded = true;
	this.draw_sphere();
}

Photosphere.prototype.draw_sphere = function()
{
	this.gl.viewport(0, 0, this.gl.viewport_width, this.gl.viewport_height);

	if (this.texture.loaded) {
		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
		this.gl.uniform1i(this.shader_program.unif_tex, 0);
	} else if (this.texture_low.loaded) {
		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture_low);
		this.gl.uniform1i(this.shader_program.unif_tex, 0);
	}

	var camera_yaw_mat_raw = [
		 Math.cos(this.camera_yaw), Math.sin(this.camera_yaw), 0,
		-Math.sin(this.camera_yaw), Math.cos(this.camera_yaw), 0,
		 0,                    0,                    1
	]

	var camera_pitch_mat_raw = [
		1,  0,                      0,
		0,  Math.cos(this.camera_pitch), Math.sin(this.camera_pitch),
		0, -Math.sin(this.camera_pitch), Math.cos(this.camera_pitch)
	]

	var camera_mat_raw = this.multiply_matrices(camera_pitch_mat_raw, camera_yaw_mat_raw);

	var camera_rot = new Float32Array(camera_mat_raw);

	var aspect = this.gl.viewport_width / this.gl.viewport_height;

	var fov_y = this.camera_fov_y_degrees / 180 * Math.PI;
	var fov_x = 2 * Math.atan(aspect * Math.tan(fov_y / 2))

	this.gl.uniform1f(this.shader_program.unif_fov_x, fov_x);
	this.gl.uniform1f(this.shader_program.unif_fov_y, fov_y);
	this.gl.uniformMatrix3fv(this.shader_program.unif_camera_rot, false, camera_rot);

	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vrt_pos_buf);
	this.gl.vertexAttribPointer(this.shader_program.vrt_pos_attr, this.vrt_pos_buf.item_size, this.gl.FLOAT, false, 0, 0);
	this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.vrt_pos_buf.num_items);
}

Photosphere.prototype.mouse_event_down = function(event)
{
	if (event.button == 0) {
		this.camera_rotating = true;
		this.mouse_last_pos_x = event.screenX;
		this.mouse_last_pos_y = event.screenY;
	}
}

Photosphere.prototype.mouse_event_up = function(event)
{
	if (event.button == 0) {
		this.camera_rotating = false;
	}
}

Photosphere.prototype.mouse_event_move = function(event)
{
	if ((event.buttons != undefined && event.buttons & 1) ||
	    (event.buttons == undefined && this.camera_rotating)) {
		var delta_x = event.screenX - this.mouse_last_pos_x;
		var delta_y = event.screenY - this.mouse_last_pos_y;
		this.mouse_last_pos_x = event.screenX;
		this.mouse_last_pos_y = event.screenY;

		var rot_speed = this.camera_fov_y_degrees / 35000;

		this.camera_yaw += delta_x * rot_speed;
		this.camera_pitch += delta_y * rot_speed;
		if (this.camera_pitch > Math.PI / 2) {
			this.camera_pitch = Math.PI / 2;
		} else if (this.camera_pitch < -Math.PI / 2) {
			this.camera_pitch = -Math.PI / 2;
		}
		this.draw_sphere();
	}
}

Photosphere.prototype.mouse_event_wheel = function(event)
{
	var value = event.wheelDelta;
	if (value == undefined) {
		value = -event.detail;
	}
	if (value > 0) {
		this.camera_fov_y_degrees -= 3;
		if (this.camera_fov_y_degrees < 15) {
			this.camera_fov_y_degrees = 15;
		}
	} else if (value < 0) {
		this.camera_fov_y_degrees += 3;
		if (this.camera_fov_y_degrees > 90) {
			this.camera_fov_y_degrees = 90;
		}
	}
	this.draw_sphere();
}

Photosphere.prototype.multiply_matrices = function(a, b)
{
	return [
		a[0]*b[0] + a[1]*b[3] + a[2]*b[6], a[0]*b[1] + a[1]*b[4] + a[2]*b[7], a[0]*b[2] + a[1]*b[5] + a[2]*b[8],
		a[3]*b[0] + a[4]*b[3] + a[5]*b[6], a[3]*b[1] + a[4]*b[4] + a[5]*b[7], a[3]*b[2] + a[4]*b[5] + a[5]*b[8],
		a[6]*b[0] + a[7]*b[3] + a[8]*b[6], a[6]*b[1] + a[7]*b[4] + a[8]*b[7], a[6]*b[2] + a[7]*b[5] + a[8]*b[8]
	];
}
