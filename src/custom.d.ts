declare module '*.png' {
  const value: import('react-native').ImageSourcePropType;
  export default value;
}

declare module '*.jpg' {
  const value: import('react-native').ImageSourcePropType;
  export default value;
}

declare module '*.jpeg' {
  const value: import('react-native').ImageSourcePropType;
  export default value;
}

declare module '*.webp' {
  const value: import('react-native').ImageSourcePropType;
  export default value;
}

declare module '*.gif' {
  const value: import('react-native').ImageSourcePropType;
  export default value;
}

declare module '*.svg' {
  const content: import('react').FC<import('react-native-svg').SvgProps>;
  export default content;
}
