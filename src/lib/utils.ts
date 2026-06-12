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
