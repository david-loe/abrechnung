"""Run with python3 dev-tools/tests/dependency-sync.py after building common."""
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ENTRYPOINT = Path(__file__).resolve().parents[2] / 'common/docker-entrypoint.development.sh'


class DependencySyncTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='abrechnung-dependencies-')
        self.root = Path(self.directory.name)
        self.app = self.root / 'app'
        self.cache = self.root / 'cache'
        self.app.mkdir()
        self.cache.mkdir()
        manifests = []
        for name in ['package.json', 'package-lock.json']:
            contents = b'{}\n'
            (self.app / name).write_bytes(contents)
            (self.cache / name).write_bytes(contents)
            manifests.append(f'{hashlib.sha256(contents).hexdigest()}  {name}\n')
        (self.cache / '.dependency-manifests').write_text(''.join(manifests))
        (self.cache / '.dependency-id').write_text('image-one\n')
        modules = self.cache / 'node_modules'
        modules.mkdir()
        executable = modules / 'tool'
        executable.write_text('#!/bin/sh\nexit 0\n')
        executable.chmod(0o755)
        (modules / 'common-link').symlink_to('../../common')

    def tearDown(self):
        self.directory.cleanup()

    def command(self):
        return ['docker', 'run', '--rm', '--network', 'none', '--user', f'{os.getuid()}:{os.getgid()}',
                '-e', 'DEPENDENCY_SERVICE=common', '-v', f'{self.app}:/app',
                '-v', f'{self.cache}:/npm_cache:ro', '-v', f'{ENTRYPOINT}:/entrypoint:ro',
                '--entrypoint', '/bin/sh', 'abrechnung-common', '/entrypoint', 'true']

    def run_sync(self, succeeds=True):
        result = subprocess.run(self.command(), text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode == 0, succeeds, result.stdout + result.stderr)
        return result

    def test_unchanged_start_and_replacement(self):
        first = self.run_sync()
        self.assertIn('Synchronizing', first.stdout)
        tool = self.app / 'node_modules/tool'
        stat = tool.stat()
        self.assertTrue(os.access(tool, os.X_OK))
        self.assertEqual(os.readlink(self.app / 'node_modules/common-link'), '../../common')
        self.assertNotIn('Synchronizing', self.run_sync().stdout)
        self.assertEqual(tool.stat().st_ino, stat.st_ino)
        self.assertEqual(tool.stat().st_mtime_ns, stat.st_mtime_ns)
        (self.app / 'node_modules/removed-package').mkdir()
        (self.cache / '.dependency-id').write_text('image-two\n')
        self.run_sync()
        self.assertFalse((self.app / 'node_modules/removed-package').exists())
        (self.app / 'node_modules/.dependency-id').unlink()
        self.assertIn('Synchronizing', self.run_sync().stdout)

    def test_manifest_mismatch_requires_rebuild(self):
        (self.app / 'package-lock.json').write_text('{"changed":true}')
        self.assertIn('docker compose build common', self.run_sync(False).stderr)
        self.assertFalse((self.app / 'node_modules').exists())

    def test_failed_copy_keeps_previous_installation(self):
        self.run_sync()
        (self.cache / '.dependency-id').write_text('image-two\n')
        (self.cache / 'node_modules/unreadable').write_text('incomplete dependency')
        (self.cache / 'node_modules/unreadable').chmod(0)
        self.run_sync(False)
        self.assertEqual((self.app / 'node_modules/.dependency-id').read_text(), 'image-one\n')
        (self.cache / 'node_modules/unreadable').chmod(0o644)
        self.run_sync()
        self.assertEqual((self.app / 'node_modules/.dependency-id').read_text(), 'image-two\n')

    def test_interrupted_replacement_is_recovered(self):
        self.run_sync()
        (self.app / 'node_modules').rename(self.app / '.dependency-sync/old')
        self.run_sync()
        self.assertTrue((self.app / 'node_modules/tool').exists())
        # A crash after promotion must not leave the previous dependency tree behind.
        (self.app / '.dependency-sync/old').mkdir()
        (self.app / '.dependency-sync/old/stale').write_text('old dependency')
        self.run_sync()
        self.assertFalse((self.app / '.dependency-sync/old').exists())

    def test_parallel_starts_only_copy_once(self):
        processes = [subprocess.Popen(self.command(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
        outputs = []
        for process in processes:
            stdout, stderr = process.communicate(timeout=30)
            self.assertEqual(process.returncode, 0, stdout + stderr)
            outputs.append(stdout)
        self.assertEqual(sum(output.count('Synchronizing') for output in outputs), 1)


if __name__ == '__main__':
    unittest.main()
