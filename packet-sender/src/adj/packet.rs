use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PacketType {
    Data,
    Protection,
    Order,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Packet {
    pub id: u16,
    pub name: String,
    #[serde(rename = "type")]
    pub packet_type: PacketType,
    pub variables: Vec<Variable>,
    #[serde(default)]
    pub variables_ids: Vec<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    pub id: u16,
    pub name: String,
    #[serde(rename = "type")]
    pub value_type: ValueType,
    #[serde(default)]
    pub units: Option<String>,
    #[serde(default)]
    pub safe_range: Option<[Option<f64>; 2]>,
    #[serde(default)]
    pub warning_range: Option<[Option<f64>; 2]>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ValueType {
    UInt8,
    UInt16,
    UInt32,
    UInt64,
    Int8,
    Int16,
    Int32,
    Int64,
    Float32,
    Float64,
    Bool,
    Enum(Vec<String>),
    String,
}

impl Serialize for ValueType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            ValueType::UInt8 => serializer.serialize_str("uint8"),
            ValueType::UInt16 => serializer.serialize_str("uint16"),
            ValueType::UInt32 => serializer.serialize_str("uint32"),
            ValueType::UInt64 => serializer.serialize_str("uint64"),
            ValueType::Int8 => serializer.serialize_str("int8"),
            ValueType::Int16 => serializer.serialize_str("int16"),
            ValueType::Int32 => serializer.serialize_str("int32"),
            ValueType::Int64 => serializer.serialize_str("int64"),
            ValueType::Float32 => serializer.serialize_str("float32"),
            ValueType::Float64 => serializer.serialize_str("float64"),
            ValueType::Bool => serializer.serialize_str("bool"),
            ValueType::String => serializer.serialize_str("string"),
            ValueType::Enum(values) => {
                let enum_str = format!("enum({})", values.join(","));
                serializer.serialize_str(&enum_str)
            }
        }
    }
}

impl<'de> Deserialize<'de> for ValueType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        match s.as_str() {
            "uint8" => Ok(ValueType::UInt8),
            "uint16" => Ok(ValueType::UInt16),
            "uint32" => Ok(ValueType::UInt32),
            "uint64" => Ok(ValueType::UInt64),
            "int8" => Ok(ValueType::Int8),
            "int16" => Ok(ValueType::Int16),
            "int32" => Ok(ValueType::Int32),
            "int64" => Ok(ValueType::Int64),
            "float32" => Ok(ValueType::Float32),
            "float64" => Ok(ValueType::Float64),
            "bool" => Ok(ValueType::Bool),
            "string" => Ok(ValueType::String),
            s if s.starts_with("enum(") && s.ends_with(")") => {
                let content = &s[5..s.len() - 1];
                let values: Vec<String> =
                    content.split(',').map(|v| v.trim().to_string()).collect();
                Ok(ValueType::Enum(values))
            }
            _ => Err(serde::de::Error::custom(format!(
                "Unknown value type: {}",
                s
            ))),
        }
    }
}

impl ValueType {
    pub fn size_bytes(&self) -> usize {
        match self {
            ValueType::UInt8 | ValueType::Int8 | ValueType::Bool => 1,
            ValueType::UInt16 | ValueType::Int16 => 2,
            ValueType::UInt32 | ValueType::Int32 | ValueType::Float32 => 4,
            ValueType::UInt64 | ValueType::Int64 | ValueType::Float64 => 8,
            ValueType::Enum(_) => 1, // Enums are typically stored as uint8
            ValueType::String => 0,  // Variable size
        }
    }

    pub fn max_value(&self) -> f64 {
        match self {
            ValueType::UInt8 => u8::MAX as f64,
            ValueType::UInt16 => u16::MAX as f64,
            ValueType::UInt32 => u32::MAX as f64,
            ValueType::UInt64 => u64::MAX as f64,
            ValueType::Int8 => i8::MAX as f64,
            ValueType::Int16 => i16::MAX as f64,
            ValueType::Int32 => i32::MAX as f64,
            ValueType::Int64 => i64::MAX as f64,
            ValueType::Float32 => f32::MAX as f64,
            ValueType::Float64 => f64::MAX,
            ValueType::Bool => 1.0,
            ValueType::Enum(values) => values.len() as f64 - 1.0,
            ValueType::String => 0.0,
        }
    }

    pub fn min_value(&self) -> f64 {
        match self {
            ValueType::UInt8 => 0.0,
            ValueType::UInt16 => 0.0,
            ValueType::UInt32 => 0.0,
            ValueType::UInt64 => 0.0,
            ValueType::Int8 => i8::MIN as f64,
            ValueType::Int16 => i16::MIN as f64,
            ValueType::Int32 => i32::MIN as f64,
            ValueType::Int64 => i64::MIN as f64,
            ValueType::Float32 => f32::MIN as f64,
            ValueType::Float64 => f64::MIN,
            ValueType::Bool => 0.0,
            ValueType::Enum(_) => 0.0,
            ValueType::String => 0.0,
        }
    }
}
