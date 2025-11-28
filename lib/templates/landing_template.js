/**
 * Custom landing page template for Hanime Stremio Addon
 * Replaces the default SDK landing page with a custom design
 */

const { buildFullUrl } = require('../config');

/**
 * Generate custom landing page HTML
 * @param {Object} manifest - Addon manifest object
 * @returns {string} HTML string
 */
function generateLandingHTML(manifest) {
  // Use URLs from manifest (already full URLs) or build them
  const logoUrl = manifest.logo || buildFullUrl('/images/logo.jpg');
  const backgroundUrl = manifest.background || buildFullUrl('/images/background.jpg');
  const iconUrl = manifest.icon || buildFullUrl('/images/favicon.ico');
  const name = manifest.name || 'Hanime';
  const version = manifest.version || '1.0.0';
  const description = manifest.description || '';
  
  // Generate catalog types list
  const catalogTypes = manifest.catalogs || [];
  
  // Generate form fields from config
  const configFieldsArray = manifest.config || [];
  const configFields = configFieldsArray.length > 0 ? configFieldsArray.map(field => {
    const inputType = field.type === 'password' ? 'password' : 'text';
    const isEmail = field.key.toLowerCase() === 'email';
    const isPassword = field.key.toLowerCase() === 'password';
    const autocomplete = isEmail ? 'email' : isPassword ? 'current-password' : 'off';
    const helperText = isEmail || isPassword 
      ? `<p class="mt-1.5 text-xs text-white/60">Your ${isEmail ? 'hanime.tv' : 'hanime.tv'} account ${isEmail ? 'email' : 'password'}</p>`
      : '';
    
    return `
			<div class="mb-6">
				<label for="${field.key}" class="block text-sm font-medium text-white/90 mb-2">
					${escapeHtml(field.title || field.key)}
				</label>
				<input 
					type="${inputType}" 
					id="${field.key}" 
					name="${field.key}" 
					autocomplete="${autocomplete}"
					class="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
					placeholder="${isEmail ? 'your-email@example.com' : isPassword ? 'Your hanime.tv password' : escapeHtml(field.title || field.key)}"
					${field.required ? 'required' : ''}
				/>
				${helperText}
			</div>`;
  }).join('\n\t\t\t') : '';

  return `<!DOCTYPE html>
<html class="h-full">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(name)} - Stremio Addon</title>
	<link rel="stylesheet" href="/css/tailwind.css">
	<link rel="shortcut icon" href="${iconUrl}" type="image/x-icon">
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
	<style>
		body {
			font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		}
		html {
			background-image: url(${backgroundUrl});
			background-size: cover;
			background-position: center center;
			background-repeat: no-repeat;
			background-attachment: fixed;
		}
	</style>
</head>
<body class="min-h-screen flex items-center justify-center p-4 md:p-8" style="background: linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.5));">
	<div class="w-full max-w-md mx-auto">
		<div class="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 md:p-10 border border-white/20">
			<!-- Logo -->
			<div class="flex justify-center mb-6">
				<div class="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden bg-white/10 p-2 border-2 border-white/20">
					<img src="${logoUrl}" alt="${escapeHtml(name)}" class="w-full h-full object-cover rounded-full">
				</div>
			</div>

			<!-- Title and Version -->
			<div class="text-center mb-6">
				<h1 class="text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-lg">
					${escapeHtml(name)}
				</h1>
				<div class="inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
					<span class="text-sm md:text-base text-white/80 font-medium">v${escapeHtml(version)}</span>
				</div>
			</div>

			<!-- Description -->
			<p class="text-center text-white/90 text-sm md:text-base mb-8 leading-relaxed drop-shadow">
				${escapeHtml(description)}
			</p>


			<!-- Form -->
			${configFieldsArray.length > 0 ? `
			<form id="mainForm" class="mb-6">
				${configFields}
			</form>
			
			<!-- Generated URL Display -->
			<div class="mb-8">
				<label for="generatedUrl" class="block text-sm font-medium text-white/90 mb-2">
					Addon URL
				</label>
				<div class="flex items-center gap-2">
					<input 
						type="text" 
						id="generatedUrl" 
						readonly
						class="flex-1 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
						value=""
					/>
					<button 
						type="button"
						id="copyUrlBtn"
						class="px-4 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg text-white transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
						title="Copy URL"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
						</svg>
					</button>
				</div>
				<p class="mt-1.5 text-xs text-white/60">This URL will be generated as you fill in the form</p>
			</div>
			` : ''}

			<!-- Install Buttons -->
			<div class="space-y-3">
				<a id="installLink" href="#" class="block w-full">
					<button 
						type="button"
						class="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-purple-500/50 active:scale-[0.98]"
					>
						<span class="flex items-center justify-center">
							<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
							</svg>
							INSTALL ON DESKTOP
						</span>
					</button>
				</a>
				<a id="installWebLink" href="#" target="_blank" rel="noopener noreferrer" class="block w-full">
					<button 
						type="button"
						class="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500/50 active:scale-[0.98]"
					>
						<span class="flex items-center justify-center">
							<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
							</svg>
							INSTALL ON WEB
						</span>
					</button>
				</a>
			</div>
		</div>
	</div>
	<script>
		const installLink = document.getElementById('installLink');
		const installWebLink = document.getElementById('installWebLink');
		const mainForm = document.getElementById('mainForm');
		const generatedUrlInput = document.getElementById('generatedUrl');
		const copyUrlBtn = document.getElementById('copyUrlBtn');
		
		const getManifestUrl = () => {
			if (mainForm) {
				const config = Object.fromEntries(new FormData(mainForm));
				// Filter out empty values
				const filteredConfig = Object.fromEntries(
					Object.entries(config).filter(([_, value]) => value && value.trim() !== '')
				);
				
				if (Object.keys(filteredConfig).length > 0) {
					const configJson = JSON.stringify(filteredConfig);
					const urlEncodedConfig = encodeURIComponent(configJson);
					return window.location.protocol + '//' + window.location.host + '/' + urlEncodedConfig + '/manifest.json';
				}
			}
			return window.location.protocol + '//' + window.location.host + '/manifest.json';
		};
		
		const updateLinks = () => {
			const manifestUrl = getManifestUrl();
			
			// Update the generated URL input
			if (generatedUrlInput) {
				generatedUrlInput.value = manifestUrl;
			}
			
			// Desktop install link (stremio:// protocol)
			if (installLink) {
				const config = mainForm ? Object.fromEntries(new FormData(mainForm)) : {};
				const filteredConfig = Object.fromEntries(
					Object.entries(config).filter(([_, value]) => value && value.trim() !== '')
				);
				
				if (Object.keys(filteredConfig).length > 0) {
					const configJson = JSON.stringify(filteredConfig);
					const urlEncodedConfig = encodeURIComponent(configJson);
					installLink.href = 'stremio://' + window.location.host + '/' + urlEncodedConfig + '/manifest.json';
				} else {
					installLink.href = 'stremio://' + window.location.host + '/manifest.json';
				}
			}
			
			// Web install link
			if (installWebLink) {
				installWebLink.href = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(manifestUrl);
			}
		};
		
		// Copy URL to clipboard
		if (copyUrlBtn && generatedUrlInput) {
			copyUrlBtn.addEventListener('click', () => {
				generatedUrlInput.select();
				generatedUrlInput.setSelectionRange(0, 99999); // For mobile devices
				try {
					document.execCommand('copy');
					// Visual feedback
					const originalHTML = copyUrlBtn.innerHTML;
					const checkIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
					checkIcon.setAttribute('class', 'w-5 h-5 text-green-400');
					checkIcon.setAttribute('fill', 'none');
					checkIcon.setAttribute('stroke', 'currentColor');
					checkIcon.setAttribute('viewBox', '0 0 24 24');
					const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
					path.setAttribute('stroke-linecap', 'round');
					path.setAttribute('stroke-linejoin', 'round');
					path.setAttribute('stroke-width', '2');
					path.setAttribute('d', 'M5 13l4 4L19 7');
					checkIcon.appendChild(path);
					copyUrlBtn.innerHTML = '';
					copyUrlBtn.appendChild(checkIcon);
					setTimeout(() => {
						copyUrlBtn.innerHTML = originalHTML;
					}, 2000);
				} catch (err) {
					console.error('Failed to copy:', err);
				}
			});
		}
		
		if (installLink && mainForm) {
			installLink.onclick = (e) => {
				if (!mainForm.reportValidity()) {
					e.preventDefault();
					return false;
				}
			};
		}
		
		// Update links on any input change (real-time)
		if (mainForm) {
			mainForm.addEventListener('change', updateLinks);
			mainForm.addEventListener('input', updateLinks);
			mainForm.addEventListener('keyup', updateLinks);
		}
		
		// Initial update
		updateLinks();
	</script>
</body>
</html>`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

module.exports = generateLandingHTML;
