import { supabase } from './supabase';
import { Class } from '@shared/schema';

// UUID-compatible storage methods that work with Supabase

export async function getClassesByTeacherIdUUID(teacherId: string): Promise<Class[]> {
  console.log(`[getClassesByTeacherIdUUID] Getting classes for teacher UUID: ${teacherId}`);
  
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[getClassesByTeacherIdUUID] Error:', error);
    throw error;
  }
  
  console.log(`[getClassesByTeacherIdUUID] Found ${data?.length || 0} classes`);
  return data || [];
}

export async function generateUniqueClassCodeSupabase(): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code: string;
  let isUnique = false;
  
  while (!isUnique) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Check directly against Supabase
    const { data: existing } = await supabase
      .from('classes')
      .select('id')
      .eq('code', code)
      .single();
    
    if (!existing) {
      isUnique = true;
      return code;
    }
  }
  
  throw new Error('Failed to generate unique class code');
}

export async function createClassUUID(classData: { 
  name: string; 
  teacherId: string; 
  iconEmoji?: string; 
  iconColor?: string;
  code: string;
}): Promise<Class> {
  console.log(`[createClassUUID] Creating class for teacher UUID: ${classData.teacherId}`);
  
  const { data, error } = await supabase
    .from('classes')
    .insert([{
      name: classData.name,
      teacher_id: classData.teacherId,
      icon_emoji: classData.iconEmoji || '📚',
      icon_color: classData.iconColor || '#c5d49f',
      code: classData.code
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[createClassUUID] Error:', error);
    throw error;
  }
  
  // Transform snake_case to camelCase and ensure correct types
  return {
    id: data.id,
    name: data.name,
    code: data.code,
    teacherId: data.teacher_id,
    iconEmoji: data.icon_emoji,
    iconColor: data.icon_color,
    createdAt: new Date(data.created_at)
  };
}

// Export a wrapper for storage methods that need UUID support
export const uuidStorage = {
  getClassesByTeacherId: getClassesByTeacherIdUUID,
  createClass: createClassUUID,
  generateUniqueClassCode: generateUniqueClassCodeSupabase,
};
