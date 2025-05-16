using Godot;
using System;

public class Player : KinematicBody2D
{
    // Declare member variables here. Examples:
    // private int a = 2;
    // private string b = "text";

    // Called when the node enters the scene tree for the first time.
    public override void _Ready()
    {

    }
    
     [Export] public int Speed = 300;      // pixels/sec
    private Vector2 _velocity = Vector2.Zero;
        // Godot enum for common joystick axes:
    private const int AxisLeftX = (int)JoystickList.Axis0; 
    private const int AxisLeftY = (int)JoystickList.Axis1;

    public override void _PhysicsProcess(float delta)
    {
        // Reset velocity each frame
        _velocity = Vector2.Zero;

        // Read input
        if (Input.IsActionPressed("ui_right"))
            _velocity.x += 1;
        if (Input.IsActionPressed("ui_left"))
            _velocity.x -= 1;
        if (Input.IsActionPressed("ui_down"))
            _velocity.y += 1;
        if (Input.IsActionPressed("ui_up"))
            _velocity.y -= 1;

        // 3) Gamepad left‐stick input (device 0)
        //    Axis returns –1…1; ignore small deadzone values:
        float joyX = Input.GetJoyAxis(0, AxisLeftX);
        float joyY = Input.GetJoyAxis(0, AxisLeftY);

        const float deadzone = 0.2f;
        if (Math.Abs(joyX) > deadzone)
            _velocity.x += joyX;
        if (Math.Abs(joyY) > deadzone)
            _velocity.y += joyY;

        // Normalize so diagonal isn’t faster
        if (_velocity != Vector2.Zero)
            _velocity = _velocity.Normalized() * Speed;

        // Move and slide handles collision
        MoveAndSlide(_velocity);
    }

//  // Called every frame. 'delta' is the elapsed time since the previous frame.
    //  public override void _Process(float delta)
    //  {
    //      
    //  }
}
