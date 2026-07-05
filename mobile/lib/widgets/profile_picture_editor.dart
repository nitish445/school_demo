import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../services/profile_picture_service.dart';
import 'avatar.dart';

/// Mirrors /web/components/ui/ProfilePictureEditor.tsx: the avatar with a
/// small camera button overlay that opens the gallery/camera picker,
/// validates the file, and uploads it.
class ProfilePictureEditor extends StatefulWidget {
  const ProfilePictureEditor({
    super.key,
    required this.uid,
    required this.name,
    this.photoUrl,
    required this.extraDocPaths,
  });

  final String uid;
  final String name;
  final String? photoUrl;
  final List<String> extraDocPaths;

  @override
  State<ProfilePictureEditor> createState() => _ProfilePictureEditorState();
}

class _ProfilePictureEditorState extends State<ProfilePictureEditor> {
  bool _uploading = false;
  String? _error;

  Future<void> _pickAndUpload() async {
    final picked = await showModalBottomSheet<XFile?>(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () async {
                final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
                if (context.mounted) Navigator.pop(context, file);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take a photo'),
              onTap: () async {
                final file = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 85);
                if (context.mounted) Navigator.pop(context, file);
              },
            ),
          ],
        ),
      ),
    );
    if (picked == null) return;

    final file = File(picked.path);
    final validationError = describeProfilePictureError(file);
    if (validationError != null) {
      setState(() => _error = validationError);
      return;
    }

    setState(() {
      _error = null;
      _uploading = true;
    });
    try {
      await updateProfilePicture(widget.uid, file, widget.extraDocPaths);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not upload the picture. Please try again.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                border: Border.fromBorderSide(BorderSide(color: Colors.white, width: 4)),
              ),
              child: Avatar(name: widget.name, photoUrl: widget.photoUrl, size: 76),
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: GestureDetector(
                onTap: _uploading ? null : _pickAndUpload,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _uploading ? Colors.black45 : Colors.black87,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                  child: const Icon(Icons.camera_alt, size: 14, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
        if (_uploading)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text('Uploading...', style: TextStyle(fontSize: 12, color: Colors.black54)),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(_error!, style: const TextStyle(fontSize: 12, color: Colors.redAccent)),
          ),
      ],
    );
  }
}
