import { supabase } from '@/integrations/supabase/client';

export class SupabaseConnectionTest {
  static async testConnection() {
    try {
      console.log('🔗 Testing Supabase connection...');
      
      // Test basic connection
      const { data, error } = await supabase
        .from('calls')
        .select('count')
        .limit(1);

      if (error) {
        console.error('❌ Supabase connection failed:', error);
        return {
          success: false,
          error: error.message,
          details: error
        };
      }

      console.log('✅ Supabase connection successful!');
      
      // Test database schema
      const { data: tables, error: schemaError } = await supabase
        .rpc('get_table_info');

      return {
        success: true,
        message: 'Connected to Supabase successfully',
        data,
        tablesAvailable: !schemaError
      };

    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async testDatabaseTables() {
    try {
      console.log('📊 Testing database tables...');
      
      const tables = ['calls', 'transcripts', 'keyword_detections', 'sms_alerts', 'system_logs'];
      const results = {};

      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);

          results[table] = {
            accessible: !error,
            error: error?.message,
            hasData: data && data.length > 0
          };

          console.log(`${!error ? '✅' : '❌'} Table ${table}: ${!error ? 'accessible' : error?.message}`);
        } catch (err) {
          results[table] = {
            accessible: false,
            error: err.message
          };
        }
      }

      return {
        success: true,
        tables: results
      };

    } catch (error) {
      console.error('❌ Database test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async testEdgeFunctions() {
    try {
      console.log('🔧 Testing edge functions...');
      
      const functions = [
        'initiate-call',
        'eleven-labs-webhook',
        'eleven-labs-config',
        'test-trigger-detection'
      ];

      const results = {};

      for (const func of functions) {
        try {
          const { data, error } = await supabase.functions.invoke(func, {
            body: { test: true }
          });

          results[func] = {
            accessible: !error,
            error: error?.message,
            response: data
          };

          console.log(`${!error ? '✅' : '❌'} Function ${func}: ${!error ? 'accessible' : error?.message}`);
        } catch (err) {
          results[func] = {
            accessible: false,
            error: err.message
          };
        }
      }

      return {
        success: true,
        functions: results
      };

    } catch (error) {
      console.error('❌ Edge functions test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}