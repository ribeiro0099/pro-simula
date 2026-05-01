import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Use as credenciais que aparecem no seu painel do Supabase
  await Supabase.initialize(
    url: 'https://ukpbxtwxkurjyrnuoniy.supabase.co/rest/v1/', 
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrcGJ4dHd4a3VyanlybnVvbml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1OTcyOTQsImV4cCI6MjA5MzE3MzI5NH0.wonPrg8kUbqY0zaTsZ4UAk6K6lEROY20BPh1Fp-HSkA',
  );
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('Meu Simulado Inteligente')),
        body: const Center(child: Text('Conectado ao Supabase!')),
      ),
    );
  }
}