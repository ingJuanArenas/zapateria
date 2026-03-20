import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://cspyzpskevumavjnbsvt.supabase.co";
const supabaseAnonKey = "sb_publishable_Jyl3SzvvWJEQstXWcd165g_0A8yrGgy";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);