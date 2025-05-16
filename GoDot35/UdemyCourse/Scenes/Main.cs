using Godot;
using System;

public class Main : Node2D
{
    private Sprite _icon;


    // Declare member variables here. Examples:
    // private int a = 2;
    // private string b = "text";

    // Called when the node enters the scene tree for the first time.
    public override void _Ready()
    {
        _icon = GetNode<Sprite>("Sprite");
    }

    // Called every frame. 'delta' is the elapsed time since the previous frame.
    public override void _Process(float delta)
    {
        _icon.Position += new Vector2(3, 0);
        if(_icon.Position.x > GetViewportRect().Size.x)
        {
            _icon.Position = new Vector2(0, _icon.Position.y);
        }
    }
}
