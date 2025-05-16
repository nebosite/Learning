using Godot;
using System;

public class PlayerTypeA : KinematicBody2D
{
 [Export] public int Speed = 300;
    private Vector2 _velocity = Vector2.Zero;

    // Godot enum for common joystick axes:
    private const int AxisLeftX = (int)JoystickList.Axis0; 
    private const int AxisLeftY = (int)JoystickList.Axis1;

    public override void _PhysicsProcess(float delta)
    {
        // 1) Start with zeroed velocity
        _velocity = Vector2.Zero;

        // 2) Keyboard input (as before)
        _velocity.x += Input.GetActionStrength("ui_right");
        _velocity.x -= Input.GetActionStrength("ui_left");
        _velocity.y += Input.GetActionStrength("ui_down");
        _velocity.y -= Input.GetActionStrength("ui_up");

        // 3) Gamepad left‐stick input (device 0)
        //    Axis returns –1…1; ignore small deadzone values:
        float joyX = Input.GetJoyAxis(0, AxisLeftX);
        float joyY = Input.GetJoyAxis(0, AxisLeftY);

        const float deadzone = 0.2f;
        if (Math.Abs(joyX) > deadzone)
            _velocity.x += joyX;
        if (Math.Abs(joyY) > deadzone)
            _velocity.y += joyY;

        // 4) Normalize & scale
        if (_velocity != Vector2.Zero)
            _velocity = _velocity.Normalized() * Speed;

        // 5) Move and handle collisions
        MoveAndSlide(_velocity);
    }
}
