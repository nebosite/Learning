console.log("Smorgy borgy");

function GetInstanceType(obj: object)
{
    var str = obj.constructor.toString();
    //console.log("str: " +str)
    return str.substring(9, str.indexOf("("));
}



class Base {
    static mType = "base"
    baseValue = "basey"
}

class Child extends Base {
    static mType = "child"
    childValue = "childish"
}

const foo = new Child();

console.log("Child.mytype: " + Child.mType)
console.log("foo.baseValue: " + foo.baseValue)
console.log("foo.childValue: " + foo.childValue)
console.log(JSON.stringify(foo))

console.log("\n----------------\n")

console.log("InstanceType foo: " + GetInstanceType(foo))
foo.childValue = "new c"
foo.baseValue = "new b"
const json = JSON.stringify(foo);

const hydrator = (foo as object).constructor



console.log("\n----------------\n")

