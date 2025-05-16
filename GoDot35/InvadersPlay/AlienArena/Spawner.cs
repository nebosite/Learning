using Godot;
using System;

public class Spawner : Node2D
{
    // 1. Expose the PackedScene so you can assign it in the Inspector
    [Export] public PackedScene AlienScene;

    // 2. How often (seconds) between spawns
    [Export] public float SpawnInterval = 2.0f;

    private Timer _spawnTimer;

    public override void _Ready()
    {
        // 3. Create and configure a Timer node
        _spawnTimer = new Timer();
        _spawnTimer.WaitTime = SpawnInterval;
        _spawnTimer.OneShot = false;
        _spawnTimer.Autostart = true;
        AddChild(_spawnTimer);

        // 4. Connect the timeout signal
        _spawnTimer.Connect("timeout", this, nameof(OnSpawnTimeout));
    }

    private void OnSpawnTimeout()
    {
        SpawnAlien();
    }

    private void SpawnAlien()
    {
        // 5. Instance the Alien scene
        var alienInstance = (Node2D)AlienScene.Instance();

        // 6. Position it somewhere (e.g., random x at top of screen)
        var screenSize = GetViewportRect().Size;
        float x = (float)GD.RandRange(0, screenSize.x);
        alienInstance.Position = new Vector2(x, 150); 
        // 7. Add it to the scene tree (as a sibling of the Spawner)
        GetParent().AddChild(alienInstance);
    }
}
