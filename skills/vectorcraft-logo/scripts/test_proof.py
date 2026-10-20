"""Exercise proof reporting through its CLI with isolated vector fixtures."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class ProofTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix="vectorcraft-logo-proof-")
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.positive = self.root / "positive.svg"
        self.reverse = self.root / "reverse.svg"
        for target, colour in [(self.positive, "black"), (self.reverse, "white")]:
            target.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path fill="{colour}" d="M0 0H40V40H0Z"/></svg>')

    def run_proof(self, *args):
        return subprocess.run([sys.executable, str(Path(__file__).with_name("proof.py")), *map(str, args), "--out", str(self.root / "proof")], capture_output=True, text=True)

    def report(self):
        return json.loads((self.root / "proof/findings.json").read_text())

    def test_structure_pass_does_not_pass_missing_reverse_or_visual_review(self):
        result = self.run_proof("--mark", self.positive)
        self.assertEqual(result.returncode, 1, result.stderr)
        report = self.report()
        self.assertTrue(report["structuralOk"])
        self.assertFalse(report["requiredVariantsPresent"])
        self.assertEqual(report["missingVariants"], ["reverse_mark"])
        self.assertEqual(report["visualReview"]["status"], "pending")
        self.assertNotIn("ok", report)

    def test_wordmark_only_supports_actual_application_width_and_remains_unreviewed(self):
        result = self.run_proof("--wordmark", self.positive, "--reverse-wordmark", self.reverse, "--wordmark-widths", 156, 218)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = self.report()
        self.assertTrue(report["requiredVariantsPresent"])
        self.assertEqual(report["proofDimensions"]["wordmarkWidths"], [156, 218])
        self.assertEqual(report["visualReview"]["status"], "pending")
        page = (self.root / "proof/index.html").read_text()
        self.assertIn("width:156px", page)
        self.assertIn("Visual review pending", page)
        self.assertNotIn("mark.svg", page.replace("wordmark.svg", ""))

    def test_unsafe_or_font_dependent_svg_is_not_copied_to_proof(self):
        self.positive.write_text('<svg viewBox="0 0 40 40"><script>alert(1)</script><text>Logo</text></svg>')
        result = self.run_proof("--mark", self.positive, "--reverse-mark", self.reverse)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertFalse(self.report()["structuralOk"])
        self.assertFalse((self.root / "proof/assets/mark.svg").exists())

    def test_invalid_dimensions_and_orphan_reverse_are_rejected(self):
        for args in [("--mark", self.positive, "--mark-sizes", 0), ("--mark", self.positive, "--reverse-wordmark", self.reverse)]:
            with self.subTest(args=args):
                result = self.run_proof(*args)
                self.assertEqual(result.returncode, 2)
                self.assertFalse((self.root / "proof/index.html").exists())


if __name__ == "__main__":
    unittest.main()
