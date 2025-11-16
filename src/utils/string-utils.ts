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

/**
 * Sanitiza un string para su uso seguro como nombre de archivo
 * Elimina acentos, caracteres especiales y previene inyección de rutas
 * @param filename - El nombre de archivo a sanitizar
 * @returns El nombre de archivo sanitizado (solo a-z, A-Z, 0-9, _, -, .)
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  return filename
    .normalize("NFD")                      // Normalizar Unicode a forma descompuesta
    .replace(/[\u0300-\u036f]/g, "")      // Eliminar marcas diacríticas (acentos)
    .replace(/[^a-zA-Z0-9_\-\.]/g, "_")   // Reemplazar caracteres especiales con underscore
    .replace(/\.{2,}/g, ".")              // Prevenir múltiples puntos consecutivos (..)
    .replace(/_{2,}/g, "_")               // Colapsar múltiples underscores
    .replace(/^[_\-\.]+|[_\-\.]+$/g, "") // Limpiar caracteres especiales al inicio/final
    .substring(0, 200)                    // Limitar longitud máxima
    || 'unnamed';                          // Fallback si el resultado es vacío
}