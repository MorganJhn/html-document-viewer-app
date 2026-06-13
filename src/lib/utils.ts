export function formatBreadcrumb(label: string): string {
  const quoteIdx = label.indexOf(' "');
  return quoteIdx !== -1 ? label.substring(0, quoteIdx) : label;
}

export function triggerConfetti() {
  const container = document.createElement('div')
  container.className = 'confetti-container'
  document.body.appendChild(container)
  
  const colors = ['#0A84FF', '#BF5AF2', '#64D2FF', '#FF9F0A', '#FF375F', '#30D158']
  const count = 30
  
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div')
    particle.className = 'confetti-particle'
    
    const size = Math.random() * 6 + 4
    const color = colors[Math.floor(Math.random() * colors.length)]
    
    particle.style.width = `${size}px`
    particle.style.height = `${size}px`
    particle.style.backgroundColor = color
    particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '0'
    
    particle.style.left = '50%'
    particle.style.top = '45%'
    
    const angle = Math.random() * Math.PI * 2
    const velocity = Math.random() * 120 + 80
    const tx = Math.cos(angle) * velocity
    const ty = Math.sin(angle) * velocity - 60
    
    particle.style.setProperty('--tx', `${tx}px`)
    particle.style.setProperty('--ty', `${ty}px`)
    particle.style.setProperty('--rot', `${Math.random() * 360}deg`)
    
    container.appendChild(particle)
  }
  
  setTimeout(() => {
    container.remove()
  }, 1200)
}

export function toast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  window.dispatchEvent(new CustomEvent('hdv-toast', { detail: { message, type } }))
}

export function colorToHex(color: string): string {
  if (!color) return '#ffffff'
  const trimmed = color.trim().toLowerCase()
  
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) {
    if (trimmed.length === 4) {
      return '#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3]
    }
    if (trimmed.length === 5) {
      return '#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3]
    }
    if (trimmed.length === 7) return trimmed
    if (trimmed.length === 9) return trimmed.slice(0, 7)
  }

  const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/)
  if (rgbMatch) {
    const r = Number.parseInt(rgbMatch[1], 10)
    const g = Number.parseInt(rgbMatch[2], 10)
    const b = Number.parseInt(rgbMatch[3], 10)
    const a = rgbMatch[4] !== undefined ? Number.parseFloat(rgbMatch[4]) : 1
    
    if (a === 0) {
      return '#ffffff'
    }

    const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
    return `#${hex}`
  }

  const colors: Record<string, string> = {
    transparent: '#ffffff',
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#00ff00',
    blue: '#0000ff',
    yellow: '#ffff00',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    gray: '#808080',
    grey: '#808080',
    silver: '#c0c0c0',
    maroon: '#800000',
    olive: '#808000',
    purple: '#800080',
    teal: '#008080',
    navy: '#000080',
    orange: '#ffa500',
    pink: '#ffc0cb',
    brown: '#a52a2a',
    gold: '#ffd700',
  }
  return colors[trimmed] || '#ffffff'
}

