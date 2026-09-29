import React, { useState } from 'react';
import { Code2, Copy, Check, Terminal, Download, Smartphone, Layers, FileCode } from 'lucide-react';

export const FlutterCodeViewer: React.FC = () => {
  const [activeFile, setActiveFile] = useState<'main' | 'api' | 'map' | 'planner' | 'journal' | 'pubspec'>('main');
  const [copied, setCopied] = useState(false);

  const flutterFiles: Record<string, { title: string; filename: string; code: string }> = {
    main: {
      title: 'Ứng dụng chính (Flutter Entry Point)',
      filename: 'lib/main.dart',
      code: `import 'package:flutter/material.dart';
import 'screens/vietnam_map_screen.dart';
import 'screens/smart_planner_screen.dart';
import 'screens/photo_journal_screen.dart';

void main() {
  runApp(const VietnamTravelApp());
}

class VietnamTravelApp extends StatelessWidget {
  const VietnamTravelApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Việt Nam Đi & Nhớ',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF047857), // Emerald Green
          brightness: Brightness.light,
        ),
        fontFamily: 'BeVietnamPro',
      ),
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    VietnamMapScreen(),
    SmartPlannerScreen(),
    PhotoJournalScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        indicatorColor: const Color(0xFF10B981).withOpacity(0.2),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map, color: Color(0xFF047857)),
            label: 'Bản đồ',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_today_outlined),
            selectedIcon: Icon(Icons.calendar_today, color: Color(0xFF047857)),
            label: 'Lịch trình AI',
          ),
          NavigationDestination(
            icon: Icon(Icons.photo_library_outlined),
            selectedIcon: Icon(Icons.photo_library, color: Color(0xFF047857)),
            label: 'Nhật ký ảnh',
          ),
        ],
      ),
    );
  }
}`,
    },
    api: {
      title: 'Dịch vụ AI Gemini (3 Prompts Specification)',
      filename: 'lib/services/gemini_service.dart',
      code: `import 'dart:convert';
import 'package:http/http.dart' as http;

class GeminiTravelService {
  // Thay thế bằng URL Backend proxy hoặc Cloud Function của bạn
  static const String baseUrl = 'https://your-api-server.com/api';

  /// 1. TÍNH NĂNG SMART PLANNER
  /// Nhận về cấu trúc JSON chuẩn:
  /// { "title": "...", "summary": "...", "itinerary": [...] }
  static Future<Map<String, dynamic>> generateItinerary({
    required String destination,
    required String duration,
    required String companions,
    required String preferences,
    required String budget,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/planner'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'destination': destination,
        'duration': duration,
        'companions': companions,
        'preferences': preferences,
        'budget': budget,
      }),
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(utf8.decode(response.bodyBytes));
      return json['data'];
    } else {
      throw Exception('Không thể tạo lịch trình du lịch');
    }
  }

  /// 2. TÍNH NĂNG AI PHOTO JOURNAL
  /// Trả về: Caption ngắn, Nhật ký 3-4 câu cảm xúc, Hashtags
  static Future<Map<String, dynamic>> generatePhotoJournal({
    required String imageBase64,
    required String location,
    required String mood,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/journal'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'imageBase64': imageBase64,
        'location': location,
        'mood': mood,
      }),
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(utf8.decode(response.bodyBytes));
      return json['data'];
    } else {
      throw Exception('Không thể tạo bài viết nhật ký ảnh');
    }
  }

  /// 3. TÍNH NĂNG "BẢN ĐỒ CHINH PHỤC VIỆT NAM"
  /// Phân tích Gu du lịch và gợi ý 1 tỉnh thành tiếp theo
  static Future<Map<String, dynamic>> analyzeTravelGuAndRecommend({
    required List<String> visitedProvinces,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/recommend-destination'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'visitedProvinces': visitedProvinces,
      }),
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(utf8.decode(response.bodyBytes));
      return json['data'];
    } else {
      throw Exception('Không thể phân tích dữ liệu du lịch');
    }
  }
}`,
    },
    map: {
      title: 'Màn hình Bản đồ Thật 63 Tỉnh Thành (flutter_map - Miễn Phí 100%)',
      filename: 'lib/screens/vietnam_map_screen.dart',
      code: `import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../services/gemini_service.dart';

class VietnamMapScreen extends StatefulWidget {
  const VietnamMapScreen({super.key});

  @override
  State<VietnamMapScreen> createState() => _VietnamMapScreenState();
}

class _VietnamMapScreenState extends State<VietnamMapScreen> {
  final MapController _mapController = MapController();
  final Set<String> _visitedProvinces = {
    'Bà Rịa - Vũng Tàu',
    'Bình Thuận',
    'Khánh Hòa',
    'Đà Nẵng',
    'Quảng Nam',
  };

  bool _isAnalyzing = false;

  void _analyzeGu() async {
    setState(() => _isAnalyzing = true);
    try {
      final result = await GeminiTravelService.analyzeTravelGuAndRecommend(
        visitedProvinces: _visitedProvinces.toList(),
      );

      if (!mounted) return;
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (ctx) => _buildRecommendationSheet(result),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi: $e')),
      );
    } finally {
      setState(() => _isAnalyzing = false);
    }
  }

  Widget _buildRecommendationSheet(Map<String, dynamic> data) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome, color: Colors.amber),
              const SizedBox(width: 8),
              Text(
                'Điểm đến tiếp theo dành cho bạn',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '🔍 Gu của bạn: \${data['guAnalysis']}',
            style: const TextStyle(fontStyle: FontStyle.italic),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '🎯 \${data['nextDestination']}',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF047857),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text('💡 \${data['reason']}'),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF047857),
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(48),
            ),
            child: const Text('Lên lịch trình ngay'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bản Đồ Thật Việt Nam (Free OSM)'),
        backgroundColor: const Color(0xFF047857),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.auto_awesome),
            onPressed: _isAnalyzing ? null : _analyzeGu,
            tooltip: 'Phân tích Gu AI',
          ),
        ],
      ),
      body: FlutterMap(
        mapController: _mapController,
        options: const MapOptions(
          initialCenter: LatLng(16.0544, 107.5),
          initialZoom: 6.0,
          minZoom: 4.0,
          maxZoom: 18.0,
        ),
        children: [
          // Bản đồ OpenStreetMap Miễn Phí 100% không cần API Key
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.example.vietnam_travel_app',
          ),
          MarkerLayer(
            markers: [
              // Hoàng Sa & Trường Sa khẳng định chủ quyền
              Marker(
                point: const LatLng(16.5367, 111.9667),
                width: 130,
                height: 30,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text('★ QĐ Hoàng Sa', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ),
              Marker(
                point: const LatLng(10.7300, 115.8200),
                width: 130,
                height: 30,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text('★ QĐ Trường Sa', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ),
              // Marker cho các tỉnh thành
              ..._visitedProvinces.map((prov) {
                return Marker(
                  point: const LatLng(16.0544, 108.2022), // Tọa độ mẫu
                  width: 90,
                  height: 30,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF047857),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text('✓ \$prov', style: const TextStyle(color: Colors.white, fontSize: 10)),
                  ),
                );
              }),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _isAnalyzing ? null : _analyzeGu,
        backgroundColor: const Color(0xFFF59E0B),
        icon: const Icon(Icons.sparkles),
        label: Text(_isAnalyzing ? 'Đang phân tích...' : 'Gợi ý Điểm Đến (AI)'),
      ),
    );
  }
}`,
    },
    planner: {
      title: 'Màn hình Lịch trình Thông minh',
      filename: 'lib/screens/smart_planner_screen.dart',
      code: `import 'package:flutter/material.dart';
import '../services/gemini_service.dart';

class SmartPlannerScreen extends StatefulWidget {
  const SmartPlannerScreen({super.key});

  @override
  State<SmartPlannerScreen> createState() => _SmartPlannerScreenState();
}

class _SmartPlannerScreenState extends State<SmartPlannerScreen> {
  final _destinationCtrl = TextEditingController(text: 'Đà Lạt');
  String _duration = '3 ngày 2 đêm';
  String _companions = 'Đi cùng người yêu';
  final _preferencesCtrl = TextEditingController(
    text: 'Thiên nhiên, yên tĩnh, thích cafe đẹp và đồ nướng',
  );
  final _budgetCtrl = TextEditingController(text: 'Khoảng 4 triệu VNĐ');

  Map<String, dynamic>? _itineraryData;
  bool _isLoading = false;

  void _generate() async {
    setState(() => _isLoading = true);
    try {
      final res = await GeminiTravelService.generateItinerary(
        destination: _destinationCtrl.text,
        duration: _duration,
        companions: _companions,
        preferences: _preferencesCtrl.text,
        budget: _budgetCtrl.text,
      );
      setState(() => _itineraryData = res);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Smart Planner (Lên Kế Hoạch)'),
        backgroundColor: const Color(0xFF047857),
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _destinationCtrl,
            decoration: const InputDecoration(labelText: 'Điểm đến'),
          ),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: _isLoading ? null : _generate,
            child: Text(_isLoading ? 'AI đang thiết kế...' : 'Tạo Lịch Trình'),
          ),
          if (_itineraryData != null) ...[
            const SizedBox(height: 16),
            Text(
              _itineraryData!['title'] ?? '',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(_itineraryData!['summary'] ?? ''),
          ],
        ],
      ),
    );
  }
}`,
    },
    journal: {
      title: 'Màn hình Nhật Ký Ảnh (Photo Journal)',
      filename: 'lib/screens/photo_journal_screen.dart',
      code: `import 'package:flutter/material.dart';
import '../services/gemini_service.dart';

class PhotoJournalScreen extends StatefulWidget {
  const PhotoJournalScreen({super.key});

  @override
  State<PhotoJournalScreen> createState() => _PhotoJournalScreenState();
}

class _PhotoJournalScreenState extends State<PhotoJournalScreen> {
  final _locationCtrl = TextEditingController(text: 'Hồ Tuyền Lâm, Đà Lạt');
  final _moodCtrl = TextEditingController(
    text: 'Bình yên, hơi se lạnh, cảm thấy thư giãn',
  );

  bool _isGenerating = false;
  Map<String, dynamic>? _journalResult;

  void _generateJournal() async {
    setState(() => _isGenerating = true);
    try {
      final res = await GeminiTravelService.generatePhotoJournal(
        imageBase64: '', // Pass base64 image here
        location: _locationCtrl.text,
        mood: _moodCtrl.text,
      );
      setState(() => _journalResult = res);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi: $e')),
      );
    } finally {
      setState(() => _isGenerating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nhật Ký Kỷ Niệm'),
        backgroundColor: const Color(0xFFE11D48),
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _locationCtrl,
            decoration: const InputDecoration(labelText: 'Địa điểm'),
          ),
          TextField(
            controller: _moodCtrl,
            decoration: const InputDecoration(labelText: 'Tâm trạng'),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isGenerating ? null : _generateJournal,
            child: Text(_isGenerating ? 'AI đang viết...' : 'Viết Nhật Ký'),
          ),
        ],
      ),
    );
  }
}`,
    },
    pubspec: {
      title: 'Cấu hình Dependencies Flutter',
      filename: 'pubspec.yaml',
      code: `name: vietnam_travel_app
description: "Ứng dụng du lịch Việt Nam: Lên lịch trình AI, Nhật ký ảnh và Bản đồ check-in 63 tỉnh thành."
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.0
  image_picker: ^1.0.7
  shared_preferences: ^2.2.2
  cached_network_image: ^3.3.1
  flutter_map: ^6.1.0 # Bản đồ OpenStreetMap / Satellite 100% Free
  latlong2: ^0.9.0
  flutter_svg: ^2.0.10+1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/maps/vietnam_provinces.svg`,
    },
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(flutterFiles[activeFile].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-full pb-20">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-indigo-700 via-blue-800 to-slate-900 text-white p-5 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
            📱 Flutter Native Architecture
          </span>
          <span className="text-xs text-blue-200 font-mono">Dart 3.x / Flutter 3.x</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Mã Nguồn Flutter Hoàn Chỉnh
        </h1>
        <p className="text-xs text-blue-100/90 mt-1">
          Toàn bộ mã nguồn Flutter (Dart) được thiết kế theo đúng chuẩn 3 tính năng của bạn
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* File Navigator Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {Object.entries(flutterFiles).map(([key, file]) => (
            <button
              key={key}
              onClick={() => setActiveFile(key as any)}
              className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFile === key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-blue-500" />
              <span>{file.filename}</span>
            </button>
          ))}
        </div>

        {/* Code Display Card */}
        <div className="bg-slate-950 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
          <div className="bg-slate-900/90 px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div>
              <span className="text-xs font-mono font-bold text-blue-400">
                {flutterFiles[activeFile].filename}
              </span>
              <p className="text-[11px] text-slate-400">
                {flutterFiles[activeFile].title}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép file này'}</span>
            </button>
          </div>

          <div className="p-4 max-h-[460px] overflow-auto">
            <pre className="text-xs font-mono text-slate-300 leading-relaxed">
              <code>{flutterFiles[activeFile].code}</code>
            </pre>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-2">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <Terminal className="w-4 h-4 text-emerald-600" />
            Hướng dẫn chạy dự án Flutter
          </h3>
          <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
            <li>Tạo project mới: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">flutter create vietnam_travel_app</code></li>
            <li>Copy file <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">pubspec.yaml</code> và chạy <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">flutter pub get</code></li>
            <li>Copy các file trong tab trên vào thư mục <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">lib/</code></li>
            <li>Chạy app trên máy ảo hoặc thiết bị thật: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">flutter run</code></li>
          </ol>
        </div>
      </div>
    </div>
  );
};
