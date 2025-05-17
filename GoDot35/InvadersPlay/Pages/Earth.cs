using Godot;
using System;

public class Earth : KinematicBody2D
{
    private PackedScene playerSource;
    private PackedScene alienSource;
    private Timer _spawnTimer;
    private Godot.Label FPSLabel;

    // Called when the node enters the scene tree for the first time.
    public override void _Ready()
    {

        _spawnTimer = new Timer();
        _spawnTimer.WaitTime = 2.0f;
        _spawnTimer.OneShot = false;
        _spawnTimer.Autostart = true;
        AddChild(_spawnTimer);
        _spawnTimer.Connect("timeout", this, nameof(OnSpawnTimeout));
        FPSLabel = GetNode<Label>("FPSLabel");

        playerSource = GD.Load<PackedScene>("res://Components/Players/PlayerTypeA.tscn");
        var player = (KinematicBody2D)playerSource.Instance();
        AddChild(player);
        player.Position = new Vector2(200, 200);

        alienSource = GD.Load<PackedScene>("res://Components/Aliens/Alien1.tscn");
    }

    private void OnSpawnTimeout()
    {
        SpawnAlien();
    }

    // Called every frame. 'delta' is the elapsed time since the previous frame.
    public override void _Process(float delta)
    {
        FPSLabel.Text = "FPS: " + (1 / delta).ToString("F2");
    }
    
     private void SpawnAlien()
    {
        // 5. Instance the Alien scene
        var alienInstance = (Node2D)alienSource.Instance();

        // 6. Position it somewhere (e.g., random x at top of screen)
        var screenSize = GetViewportRect().Size;
        float x = (float)GD.RandRange(100, screenSize.x - 100);
        alienInstance.Position = new Vector2(x, 150); // just above the top

        // 7. Add it to the scene tree (as a sibling of the Spawner)
        GetParent().AddChild(alienInstance);
    }
}
