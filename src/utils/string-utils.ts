/**
 * Limpia y normaliza un string para uso consistente en la aplicación
 * @param str - El string a limpiar
 * @returns El string limpio y normalizado
 */
export function cleanString(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str
    .trim()                    // Eliminar espacios al principio y final
    .replace(/\s+/g, ' ')      // Normalizar espacios múltiples a uno solo
    .replace(/[\u00A0]/g, ' ') // Convertir espacios no-separables a espacios normales
    .normalize('NFC');         // Normalizar caracteres Unicode
}

/**
 * Limpia un username específicamente
 * @param username - El username a limpiar
 * @returns El username limpio
 */
export function cleanUsername(username: string): string {
  const cleaned = cleanString(username);
  
  // Validaciones adicionales para username
  if (cleaned.length === 0) {
    throw new Error('Username cannot be empty');
  }
  
  if (cleaned.length > 50) {
    throw new Error('Username cannot exceed 50 characters');
  }
  
  // Verificar que no contenga solo espacios
  if (cleaned.replace(/\s/g, '').length === 0) {
    throw new Error('Username cannot contain only spaces');
  }
  
  return cleaned;
}