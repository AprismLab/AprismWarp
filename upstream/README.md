# Upstream Research Cache

The upstream TurboWarp source checkouts are local research material and are intentionally excluded from the AprismWarp repository. Recreate them at the pinned commits with:

```powershell
git clone https://github.com/TurboWarp/scratch-gui.git upstream/scratch-gui
git -C upstream/scratch-gui checkout a2946eeb9a9dca7857d7ab53d766b54288c7a2ff
git clone https://github.com/TurboWarp/scratch-vm.git upstream/scratch-vm
git -C upstream/scratch-vm checkout c4823421cb7c17d8d8a89878851ce1668c26a21f
```

The snapshots are visual and interaction references only. AprismWarp does not use Scratch project semantics, Scratch VM execution, or Scratch extensions.

Licenses and provenance are recorded in [../FACT.md](../FACT.md).

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
