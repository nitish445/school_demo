import 'package:flutter/material.dart';

import 'profile_picture_editor.dart';

/// Mirrors /web/components/ui/ProfileHero.tsx: a dark banner with the avatar
/// overlapping into the white body, name/subtitle, and optional badge chips.
class ProfileHero extends StatelessWidget {
  const ProfileHero({
    super.key,
    required this.uid,
    required this.name,
    this.subtitle,
    this.photoUrl,
    required this.extraDocPaths,
    this.badges,
  });

  final String uid;
  final String name;
  final String? subtitle;
  final String? photoUrl;
  final List<String> extraDocPaths;
  final List<Widget>? badges;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 72,
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(-0.7, -1.8),
                radius: 1.4,
                colors: [Color(0x59FBBF24), Color(0xFF1C1917)],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Transform.translate(
                  offset: const Offset(0, -38),
                  child: ProfilePictureEditor(
                    uid: uid,
                    name: name,
                    photoUrl: photoUrl,
                    extraDocPaths: extraDocPaths,
                  ),
                ),
                Transform.translate(
                  offset: const Offset(0, -28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: Theme.of(context).textTheme.headlineSmall),
                      if (subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(subtitle!,
                            style: const TextStyle(
                                color: Colors.black54, fontSize: 13)),
                      ],
                      if (badges != null && badges!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Wrap(spacing: 8, runSpacing: 8, children: badges!),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
